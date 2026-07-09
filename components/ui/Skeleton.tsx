import React from 'react';

// Extends React's standard div attribute set so callers can attach things like
// `data-testid`, `aria-*`, `role`, `id` without the primitive swallowing them.
// className stays explicit so the primitive's own classes stay at the START of
// the className string (Tailwind JIT picks up the LATER className overrides
// from the caller, which is what components like ProductCardSkeleton rely on
// for `rounded-none` to neutralise this primitive's default `rounded`).
interface SkeletonProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'className'> {
    className?: string;
}

const Skeleton: React.FC<SkeletonProps> = ({ className = '', ...rest }) => {
    return (
        <div className={`animate-pulse bg-gray-200 rounded ${className}`} {...rest}></div>
    );
};

export default Skeleton;
