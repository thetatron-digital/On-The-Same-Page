// ============================================
// URL SCHEME
// ============================================
//   /                              Home (project list)
//   /:app                          An app with no saved project open
//   /projects/:projectId/:app      An app inside a saved project
// Reloading or sharing a /projects/... URL reopens that project.

import type { AppMode } from '../store/types';

export const APP_IDS = [
  'blueprint', 'corkboard', 'rewriter', 'breakdown', 'artcart',
  'viewfinder', 'basecamp', 'onset', 'supervisor', 'bottomline',
] as const satisfies readonly Exclude<AppMode, 'home'>[];

export interface RouteTarget {
  app: AppMode;
  projectId: string | null;
}

export const HOME: RouteTarget = { app: 'home', projectId: null };

const isAppId = (value: string): value is (typeof APP_IDS)[number] =>
  (APP_IDS as readonly string[]).includes(value);

// Returns null for paths that don't belong to OTSP
export function parsePath(pathname: string): RouteTarget | null {
  const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent);

  if (parts.length === 0) return HOME;

  if (parts[0] === 'projects' && parts[1]) {
    if (parts.length === 2) return { app: 'rewriter', projectId: parts[1] };
    if (parts.length === 3 && isAppId(parts[2])) return { app: parts[2], projectId: parts[1] };
    return null;
  }

  if (parts.length === 1 && isAppId(parts[0])) return { app: parts[0], projectId: null };

  return null;
}

export function buildPath({ app, projectId }: RouteTarget): string {
  if (app === 'home') return '/';
  if (projectId) return `/projects/${encodeURIComponent(projectId)}/${app}`;
  return `/${app}`;
}
