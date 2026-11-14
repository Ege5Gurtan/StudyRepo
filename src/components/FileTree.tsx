import type { TreeNode } from '../shared/types';

export function FileTree({ nodes, open }: { nodes: TreeNode[]; open: (path: string) => void }) {
  return <ul className="tree">{nodes.map(node => <li key={node.path}>
    {node.type === 'directory'
      ? <details><summary><span className="folder-icon">▸</span> {node.name}</summary><FileTree nodes={node.children ?? []} open={open} /></details>
      : <button className="tree-file" onClick={() => open(node.path)}><span className="file-icon">{node.name.includes('.') ? node.name.split('.').pop()?.slice(0, 3).toUpperCase() : '•'}</span>{node.name}</button>}
  </li>)}</ul>;
}
