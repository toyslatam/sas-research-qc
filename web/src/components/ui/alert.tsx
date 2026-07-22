import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const alertVariants = cva('relative w-full rounded-2xl border px-4 py-3 text-sm shadow-soft', {
  variants: {
    variant: {
      default: 'border-border bg-card text-foreground',
      success: 'border-success/20 bg-success/10 text-success',
      warning: 'border-warning/20 bg-warning/10 text-warning',
      destructive: 'border-destructive/20 bg-destructive/10 text-destructive',
    },
  },
  defaultVariants: { variant: 'default' },
});

export function Alert({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h5 className={cn('mb-1 font-medium leading-none tracking-tight', className)} {...props} />;
}

export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <div className={cn('text-sm opacity-90', className)} {...props} />;
}
