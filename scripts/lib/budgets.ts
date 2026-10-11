/** The verification budgets: the frozen defaults and the merge of a team's partial override over them. */

export type DeviceBudget = { desktop: number; phone: number };
export type ReadinessBudget = {
  shellMs: DeviceBudget;
  dataMs: DeviceBudget;
  interactiveMs: DeviceBudget;
};
export type NavigationCheck = {
  path: string;
  title: string;
  readySelector: string;
  readyText?: string;
  probe: 'dialog' | 'filter' | 'sort' | 'toggle' | 'link';
  controlSelector: string;
  resultSelector: string;
  /**
   * A route whose own reading is over the shared budget may carry its own, beside the measurement that earned it in the
   * config: one heavy reading page is not the rail, and lowering every route's bar to hold one of them is not the trade.
   * Omitted, the route is held to the shared `budgets.navigation` figure like every other.
   */
  budget?: Partial<{ [K in keyof ReadinessBudget]: Partial<DeviceBudget> }>;
};
export type Budgets = {
  navigation: { warm: ReadinessBudget; cold: ReadinessBudget; afterLive: ReadinessBudget };
  firstLoadKb: number;
  firstLoadGrowthPct: number;
  htmlKb: Record<string, number>;
  prefetchKb: { desktop: number; phoneClosed: number };
};
export type BudgetsConfig = {
  budgets?: {
    navigation?: { warm?: ReadinessBudget; cold?: ReadinessBudget; afterLive?: ReadinessBudget };
    firstLoadKb?: number;
    firstLoadGrowthPct?: number;
    htmlKb?: Record<string, number>;
    prefetchKb?: { desktop: number; phoneClosed: number };
  };
};

const COLD: ReadinessBudget = {
  shellMs: { desktop: 600, phone: 1500 },
  dataMs: { desktop: 1500, phone: 3000 },
  interactiveMs: { desktop: 2000, phone: 4000 },
};

/** The HTML caps are a project's routes, so the defaults set none; the template's config sets its own. */
export const DEFAULT_BUDGETS: Budgets = {
  navigation: {
    warm: {
      shellMs: { desktop: 150, phone: 250 },
      dataMs: { desktop: 500, phone: 1500 },
      interactiveMs: { desktop: 750, phone: 2000 },
    },
    cold: COLD,
    afterLive: COLD,
  },
  firstLoadKb: 820,
  firstLoadGrowthPct: 5,
  htmlKb: {},
  prefetchKb: { desktop: 80, phoneClosed: 0 },
};

/** A config's partial budgets over the defaults; after-live follows cold unless it is set. */
export function budgetsOf(config: BudgetsConfig): Budgets {
  const b = config.budgets ?? {};
  const warm = b.navigation?.warm ?? DEFAULT_BUDGETS.navigation.warm;
  const cold = b.navigation?.cold ?? DEFAULT_BUDGETS.navigation.cold;
  return {
    navigation: { warm, cold, afterLive: b.navigation?.afterLive ?? cold },
    firstLoadKb: b.firstLoadKb ?? DEFAULT_BUDGETS.firstLoadKb,
    firstLoadGrowthPct: b.firstLoadGrowthPct ?? DEFAULT_BUDGETS.firstLoadGrowthPct,
    htmlKb: b.htmlKb ?? DEFAULT_BUDGETS.htmlKb,
    prefetchKb: b.prefetchKb ?? DEFAULT_BUDGETS.prefetchKb,
  };
}
