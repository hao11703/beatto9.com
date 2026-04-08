const root = document.documentElement;

if ("connection" in navigator) {
  const connection = navigator.connection;

  if (connection.saveData) {
    root.dataset.saveData = "true";
  }
}

const architectureLink = document.querySelector('a[href="./docs/architecture.md"]');

if (architectureLink) {
  architectureLink.addEventListener("click", () => {
    window.__beatTo9Queue = window.__beatTo9Queue || [];
    window.__beatTo9Queue.push({
      event: "architecture_open",
      ts: Date.now(),
    });
  });
}
