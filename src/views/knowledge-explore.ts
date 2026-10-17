/**
 * Knowledge's prepared query, `explore_knowledge`: the shelf, the lessons made and the searches, each over Work's
 * `/work/query` as the active team's (`src/data/prepared.ts`). Declared once here because two views offer it: Knowledge
 * at `/knowledge`, and the knowledge log at `/knowledge/log`, which is the page's log until Phase 7 removes the address
 * and asks the same three questions of the same three measures.
 *
 * It counts and drills; it never adds, supersedes or edits a lesson. A lesson is recorded by zz-core when an initiative
 * closes, and the console has no write for it.
 */
import type { PreparedQuery } from '@/lib/explore';
import { lessons, searches, shelf } from './tools/sources';

export const KNOWLEDGE_EXPLORE: PreparedQuery = { sources: { shelf, lessons, searches } };
