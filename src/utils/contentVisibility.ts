/** Remove hidden comments and their branches before rendering a discussion. */
export function filterCommentTree<T extends { comment: { author: string }; replies: T[] }>(
  nodes: T[], isHidden: (author: string) => boolean
): T[] {
  return nodes.filter(node => !isHidden(node.comment.author))
    .map(node => ({ ...node, replies: filterCommentTree(node.replies, isHidden) }));
}
