import type { ComponentType } from 'react';

type MdxComponentProps = Record<string, unknown>;
type MdxComponents = Record<string, ComponentType<MdxComponentProps>>;

export function useMDXComponents(components: MdxComponents): MdxComponents {
  return {
    h2: (props) => <h2 className="mt-8 text-2xl font-semibold text-slate-100" {...props} />,
    h3: (props) => <h3 className="mt-6 text-xl font-semibold text-slate-100" {...props} />,
    p: (props) => <p className="mt-3 leading-7 text-slate-300" {...props} />,
    ul: (props) => <ul className="mt-3 list-disc space-y-2 pl-6 text-slate-300" {...props} />,
    ol: (props) => <ol className="mt-3 list-decimal space-y-2 pl-6 text-slate-300" {...props} />,
    code: (props) => (
      <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-sm text-cyan-200" {...props} />
    ),
    a: (props) => <a className="text-cyan-300 underline decoration-cyan-500/60" {...props} />,
    ...components
  };
}
