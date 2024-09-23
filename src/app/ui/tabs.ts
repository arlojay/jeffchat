export function initTabs() {
    const sidebarOptions = document.querySelectorAll("#sidebar .sidebar-option") as NodeListOf<HTMLDivElement>;

    for(const option of sidebarOptions) {
        option.addEventListener("click", () => {
            openTab(option.dataset.tabname as string);
        })
    }
}

export function openTab(tabName: string) {
    const contentTabs = document.querySelectorAll("#content .content-tab") as NodeListOf<HTMLDivElement>;
    for(const tab of contentTabs) {
        if(tab.dataset.tabname == tabName) {
            tab.hidden = false;
        } else {
            tab.hidden = true;
        }
    }
}

export function createTab(tabName: string) {
    const element = document.createElement("div");
    element.classList.add("sidebar-option");
    element.dataset.tabname = tabName;

    document.querySelector("#sidebar").appendChild(element);
    element.addEventListener("click", () => {
        openTab(tabName);
    })

    return element;
}