import { APP_VERSION } from '@/config/version';
import React, { useMemo, useState } from 'react';
import { Download, MessageSquare, X } from 'lucide-react';
import { safeStorage } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface FeedbackModalProps { isOpen: boolean; onClose: () => void }
type FeedbackType='bug'|'feature'|'data'|'other';
type Severity='low'|'medium'|'high'|'critical';
const STORAGE_KEY='resindb-feedback-queue';
export const redactFeedbackText=(value:string)=>value
  .replace(/(api[_ -]?key|token|password|secret)\s*[:=]\s*[^\s,;]+/gi,'$1=[REDACTED]')
  .replace(/\b(sk-[A-Za-z0-9_-]{8,})\b/g,'[REDACTED_KEY]');
export interface FeedbackRecord { id:string; createdAt:string; type:FeedbackType; severity:Severity; module:string; title:string; description:string; steps:string; environment:{version:string;url:string;language:string;theme:string;userAgent:string}; privacy:string }
export const buildFeedbackRecord=(input:Omit<FeedbackRecord,'id'|'createdAt'|'environment'|'privacy'>):FeedbackRecord=>({
  ...input,title:redactFeedbackText(input.title.trim()),description:redactFeedbackText(input.description.trim()),steps:redactFeedbackText(input.steps.trim()),
  id:`feedback-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,createdAt:new Date().toISOString(),
  environment:{version:APP_VERSION,url:location.pathname,language:document.documentElement.lang||'unknown',theme:document.documentElement.classList.contains('dark')?'dark':'light',userAgent:navigator.userAgent},
  privacy:'No API keys, passwords or complete resin database records are intentionally collected.',
});
const readQueue=():FeedbackRecord[]=>{try{return JSON.parse(safeStorage.local.getItem(STORAGE_KEY)||'[]') as FeedbackRecord[];}catch{return[];}};
export const FeedbackModal:React.FC<FeedbackModalProps>=({isOpen,onClose})=>{
  const { language } = useLanguage();
  const zh = language === 'zh';
  const [type,setType]=useState<FeedbackType>('bug');const[severity,setSeverity]=useState<Severity>('medium');const[module,setModule]=useState('dashboard');
  const[title,setTitle]=useState('');const[description,setDescription]=useState('');const[steps,setSteps]=useState('');const[status,setStatus]=useState<'idle'|'invalid'|'saved'|'downloaded'>('idle');
  const valid=useMemo(()=>title.trim().length>=3&&description.trim().length>=10,[title,description]);
  if(!isOpen)return null;
  const save=(download:boolean)=>{if(!valid){setStatus('invalid');return;}const record=buildFeedbackRecord({type,severity,module,title,description,steps});safeStorage.local.setItem(STORAGE_KEY,JSON.stringify([...readQueue(),record]));if(download){const blob=new Blob([JSON.stringify(record,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`resindb-feedback-${record.id}.json`;a.click();URL.revokeObjectURL(url);}setStatus(download ? 'downloaded' : 'saved');};
  return <div className="fixed inset-0 z-[230] flex items-center justify-center bg-slate-950/50 p-4" data-testid="feedback-modal"><div className="w-full max-w-xl rounded-2xl border bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-950">
    <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><MessageSquare size={18}/><h2 className="font-bold">{zh ? '反馈与诊断导出' : 'Feedback and diagnostics export'}</h2></div><button type="button" onClick={onClose} aria-label={zh ? '关闭反馈' : 'Close feedback'}><X size={18}/></button></div>
    <p className="mb-4 text-xs text-slate-500">{zh ? '当前版本没有反馈服务器。记录会保存在本浏览器，并可导出 JSON 交给维护人员；疑似密钥和密码会被自动脱敏。' : 'This version has no feedback server. Records stay in this browser and can be exported as JSON for a maintainer. Suspected keys and passwords are redacted.'}</p>
    <div className="grid gap-3 sm:grid-cols-3"><label className="text-xs">{zh ? '类型' : 'Type'}<select value={type} onChange={e=>setType(e.target.value as FeedbackType)} className="mt-1 w-full rounded-lg border p-2"><option value="bug">{zh ? '缺陷' : 'Bug'}</option><option value="feature">{zh ? '建议' : 'Suggestion'}</option><option value="data">{zh ? '数据问题' : 'Data issue'}</option><option value="other">{zh ? '其他' : 'Other'}</option></select></label><label className="text-xs">{zh ? '严重度' : 'Severity'}<select value={severity} onChange={e=>setSeverity(e.target.value as Severity)} className="mt-1 w-full rounded-lg border p-2"><option value="low">{zh ? '低' : 'Low'}</option><option value="medium">{zh ? '中' : 'Medium'}</option><option value="high">{zh ? '高' : 'High'}</option><option value="critical">{zh ? '严重' : 'Critical'}</option></select></label><label className="text-xs">{zh ? '模块' : 'Module'}<select value={module} onChange={e=>setModule(e.target.value)} className="mt-1 w-full rounded-lg border p-2"><option value="dashboard">{zh ? '数据概览' : 'Overview'}</option><option value="analytics">{zh ? '科研可视化' : 'Scientific charts'}</option><option value="data-quality">{zh ? '数据质量' : 'Data quality'}</option><option value="dependency-map">{zh ? '依赖网络谱图' : 'Dependency map'}</option><option value="pivot">{zh ? '数据透视' : 'Data pivot'}</option><option value="beta-sandbox">{zh ? '计算沙箱' : 'Calculation sandbox'}</option><option value="import-export">{zh ? '导入与导出' : 'Import and export'}</option></select></label></div>
    <label className="mt-3 block text-xs">{zh ? '标题' : 'Title'}<input data-testid="feedback-title" value={title} onChange={e=>setTitle(e.target.value)} maxLength={120} className="mt-1 w-full rounded-lg border p-2"/></label>
    <label className="mt-3 block text-xs">{zh ? '描述' : 'Description'}<textarea data-testid="feedback-description" value={description} onChange={e=>setDescription(e.target.value)} maxLength={4000} className="mt-1 h-28 w-full rounded-lg border p-2"/></label>
    <label className="mt-3 block text-xs">{zh ? '复现步骤' : 'Steps to reproduce'}<textarea value={steps} onChange={e=>setSteps(e.target.value)} maxLength={3000} className="mt-1 h-20 w-full rounded-lg border p-2"/></label>
    <div aria-live="polite" className="mt-3 min-h-5 text-xs text-emerald-600">{status === 'invalid' ? (zh ? '请填写至少 3 个字符的标题和至少 10 个字符的描述。' : 'Enter a title of at least 3 characters and a description of at least 10 characters.') : status === 'downloaded' ? (zh ? '反馈 JSON 已下载，并保存到本地待处理队列。' : 'Feedback JSON downloaded and saved to the local queue.') : status === 'saved' ? (zh ? '反馈已保存到本地待处理队列。' : 'Feedback saved to the local queue.') : ''}</div><div className="mt-3 flex justify-end gap-2"><button type="button" onClick={()=>save(false)} className="rounded-lg border px-4 py-2 text-xs">{zh ? '保存本地' : 'Save locally'}</button><button data-testid="feedback-export" type="button" onClick={()=>save(true)} className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs text-white"><Download size={14}/>{zh ? '导出 JSON' : 'Export JSON'}</button></div>
  </div></div>;
};
