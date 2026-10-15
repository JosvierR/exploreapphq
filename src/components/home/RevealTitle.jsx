import { Children, cloneElement, isValidElement } from 'react';

const titleText = children => Children.toArray(children).map(child => {
  if (!isValidElement(child)) return child;
  return child.type === 'br' ? ' ' : titleText(child.props.children);
}).join('');

export default function RevealTitle({ as: Tag = 'h2', children, mutedFrom, className = '', ...props }) {
  const label = titleText(children).replace(/\s+/g, ' ').trim();
  const mutedStart = mutedFrom ?? Math.ceil(label.split(' ').length / 2);
  let wordIndex = 0;
  const splitWords = content => Children.map(content, child => {
    if (typeof child === 'string') return child.split(/(\s+)/).map(part => {
      if (!part.trim()) return part;
      const index = wordIndex++;
      return <span className={`title-word-mask${index >= mutedStart ? ' title-tone-muted' : ''}`} aria-hidden="true" key={index}><span data-title-word style={{ '--word-index': index }}>{part}</span></span>;
    });
    if (!isValidElement(child) || !child.props.children) return child;
    return cloneElement(child, { 'aria-hidden': true }, splitWords(child.props.children));
  });
  return <Tag {...props} className={`two-tone-title ${className}`.trim()} aria-label={props['aria-label'] || label}>{splitWords(children)}</Tag>;
}
