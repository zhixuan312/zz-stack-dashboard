/** How a knowledge node is named in a list: its number and its title. */
import { clip } from './context';

export const nodeName = (n: { num: string; title: string }): string => `node ${n.num}, "${clip(n.title, 90)}"`;
