/** How a knowledge node is named in a list: its team where the shelf spans more than one, its number and its title. */
import { clip } from './context';

export const nodeName = (n: { team: string; num: string; title: string }, multiTeam: boolean): string => `${multiTeam ? `${n.team} ` : ''}node ${n.num}, "${clip(n.title, 90)}"`;
