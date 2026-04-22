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
        <line x1="12" y1="12" x2="5" y2="5" />
        <line x1="12" y1="12" x2="19" y2="5" />
        <line x1="12" y1="12" x2="5" y2="19" />
        <line x1="12" y1="12" x2="19" y2="19" />
        <circle cx="5" cy="5" r="2.4" />
        <circle cx="19" cy="5" r="2.4" />
        <circle cx="5" cy="19" r="2.4" />
        <circle cx="19" cy="19" r="2.4" />
        <path d="M10 10h4v4h-4z" />
        <path d="M3.4 5h3.2M17.4 5h3.2M3.4 19h3.2M17.4 19h3.2" />
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
