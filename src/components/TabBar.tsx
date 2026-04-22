import type { ReactNode } from "react";

export type AppTab = "now" | "map" | "drone";

type TabDef = {
  id: AppTab;
  label: string;
  icon: ReactNode;
};

function TabIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={22}
      height={22}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const TABS: TabDef[] = [
  {
    id: "now",
    label: "Now",
    icon: (
      <TabIcon>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </TabIcon>
    ),
  },
  {
    id: "map",
    label: "Map",
    icon: (
      <TabIcon>
        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
        <line x1="8" y1="2" x2="8" y2="18" />
        <line x1="16" y1="6" x2="16" y2="22" />
      </TabIcon>
    ),
  },
  {
    id: "drone",
    label: "Drone",
    icon: (
      <TabIcon>
        <circle cx="6" cy="6" r="2.5" />
        <circle cx="18" cy="6" r="2.5" />
        <circle cx="6" cy="18" r="2.5" />
        <circle cx="18" cy="18" r="2.5" />
        <rect x="9" y="9" width="6" height="6" rx="1" />
        <line x1="8" y1="8" x2="6" y2="6" />
        <line x1="16" y1="8" x2="18" y2="6" />
        <line x1="8" y1="16" x2="6" y2="18" />
        <line x1="16" y1="16" x2="18" y2="18" />
      </TabIcon>
    ),
  },
];

export function TabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}) {
  return (
    <nav className="app-tab-bar" role="tablist" aria-label="App sections">
      {TABS.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`tab-panel-${tab.id}`}
            className={`app-tab-button${isActive ? " active" : ""}`}
            onClick={() => onTabChange(tab.id)}
          >
            <span className="app-tab-icon">{tab.icon}</span>
            <span className="app-tab-label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
