import React from "react";
import { motion, HTMLMotionProps } from "motion/react";
import { cn } from "../../lib/utils";

export const Skeleton: React.FC<HTMLMotionProps<"div">> = ({
  className,
  ...props
}) => {
  return (
    <motion.div
      initial={{ opacity: 0.5 }}
      animate={{ opacity: 1 }}
      transition={{ repeat: Infinity, repeatType: "reverse", duration: 1.5 }}
      className={cn("rounded-md bg-slate-200 dark:bg-slate-800", className)}
      {...props}
    />
  );
};
