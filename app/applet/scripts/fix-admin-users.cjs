const fs = require('fs');
let content = fs.readFileSync('src/components/modals/AdminModal.tsx', 'utf-8');

const newLoadUsers = `  const loadUsers = useCallback(() => {
    try {
      const saved = localStorage.getItem("resindb-users");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Check if haojunsun exists, if not add them
          const hasHaojun = parsed.some(p => p.id === 'admin-1' || p.name === 'haojunsun');
          let finalUsers = parsed;
          if (!hasHaojun) {
             finalUsers = [{
                id: "admin-1",
                name: "haojunsun",
                email: "haojun.sun@resindb.pri",
                role: "admin",
                avatar: \`data:image/svg+xml;utf8,<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="8" fill="%234f46e5"/><ellipse cx="50" cy="50" rx="40" ry="12" stroke="%236366f1" stroke-width="2.5" transform="rotate(0 50 50)"/><ellipse cx="50" cy="50" rx="40" ry="12" stroke="%233b82f6" stroke-width="2.5" transform="rotate(60 50 50)"/><ellipse cx="50" cy="50" rx="40" ry="12" stroke="%238b5cf6" stroke-width="2.5" transform="rotate(120 50 50)"/><circle cx="90" cy="50" r="4" fill="%236366f1" /><circle cx="70" cy="84" r="4" fill="%233b82f6" /><circle cx="30" cy="16" r="4" fill="%238b5cf6" /></svg>\`
             }, ...parsed.filter(p => p.id !== 'user-001')];
             localStorage.setItem("resindb-users", JSON.stringify(finalUsers));
          }
          setUsers(finalUsers);
          setStats((prev) => ({ ...prev, totalRecords: finalUsers.length * 10 + 42 }));
          return;
        }
      }
      
      const defaultUsers = [
        {
          id: "admin-1",
          name: "haojunsun",
          email: "haojun.sun@resindb.pri",
          role: "admin",
          avatar: \`data:image/svg+xml;utf8,<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="8" fill="%234f46e5"/><ellipse cx="50" cy="50" rx="40" ry="12" stroke="%236366f1" stroke-width="2.5" transform="rotate(0 50 50)"/><ellipse cx="50" cy="50" rx="40" ry="12" stroke="%233b82f6" stroke-width="2.5" transform="rotate(60 50 50)"/><ellipse cx="50" cy="50" rx="40" ry="12" stroke="%238b5cf6" stroke-width="2.5" transform="rotate(120 50 50)"/><circle cx="90" cy="50" r="4" fill="%236366f1" /><circle cx="70" cy="84" r="4" fill="%233b82f6" /><circle cx="30" cy="16" r="4" fill="%238b5cf6" /></svg>\`
        },
        {
          id: "editor-1",
          name: "bot",
          email: "editor.bot@resindb.pri",
          role: "editor",
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=bot1"
        },
        {
          id: "viewer-1",
          name: "bot",
          email: "viewer.bot@resindb.pri",
          role: "viewer",
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=bot2"
        }
      ];
      setUsers(defaultUsers);
      localStorage.setItem("resindb-users", JSON.stringify(defaultUsers));
      setStats((prev) => ({ ...prev, totalRecords: defaultUsers.length * 10 + 42 }));
    } catch (e) {
      console.error("Failed to load users:", e);
    }
  }, []);`;

content = content.replace(/  const loadUsers = useCallback\(\(\) => \{[\s\S]*?\}, \[\]\);/, newLoadUsers);

content = content.replace(/id === "user-001"/g, 'id === "admin-1"');

fs.writeFileSync('src/components/modals/AdminModal.tsx', content);
