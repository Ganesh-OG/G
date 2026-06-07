function getVisibleCount(config) {
  return window.innerWidth < 768 ? config.mobile : config.desktop;
}

export function createCircularSlider(list, config = {}) {
  if (!list) return null;

  const selector = config.selector || ":scope > *";
  const activeAttr = config.activeAttr || "data-slider-active";
  list.classList.add("circular-slider-track");
  list.style.touchAction = "pan-y";
  let controls = list.parentNode?.querySelector(`:scope > .circular-slider-controls${config.controlsClass ? `.${config.controlsClass}` : ""}`);
  if (!controls) {
    controls = document.createElement("div");
    controls.className = `circular-slider-controls${config.controlsClass ? ` ${config.controlsClass}` : ""}`;
    controls.innerHTML = `
      <button type="button" class="circular-slider-btn prev" aria-label="Previous">
        <ion-icon name="chevron-back-outline"></ion-icon>
      </button>
      <button type="button" class="circular-slider-btn next" aria-label="Next">
        <ion-icon name="chevron-forward-outline"></ion-icon>
      </button>
    `;

    list.parentNode?.insertBefore(controls, list);
  }

  let index = 0;
  let touchStartX = 0;
  let orderedActive = [];

  const allItems = () => Array.from(list.querySelectorAll(selector));
  const activeItems = () => allItems().filter((item) => item.getAttribute(activeAttr) !== "false");
  const inactiveItems = () => allItems().filter((item) => item.getAttribute(activeAttr) === "false");

  const render = (resetIndex = false) => {
    if (resetIndex || !orderedActive.length) {
      orderedActive = activeItems();
    }

    const items = orderedActive.filter((item) => item.getAttribute(activeAttr) !== "false");
    const total = items.length;
    const visibleCount = getVisibleCount(config);

    if (!total) {
      allItems().forEach((item) => {
        item.style.display = "none";
      });
      controls.hidden = true;
      index = 0;
      return;
    }

    if (resetIndex) {
      index = 0;
    }

    index = ((index % total) + total) % total;

    const rotated = items.slice(index).concat(items.slice(0, index));
    rotated.forEach((item) => list.appendChild(item));
    inactiveItems().forEach((item) => list.appendChild(item));

    allItems().forEach((item) => {
      item.style.display = "none";
    });

    rotated.slice(0, visibleCount).forEach((item) => {
      item.style.display = "block";
    });

    controls.hidden = total <= visibleCount;
  };

  const step = (direction) => {
    const items = activeItems();
    if (!items.length) return;
    const total = items.length;
    index = (index + direction + total) % total;
    render();
  };

  controls.querySelector(".prev")?.addEventListener("click", () => step(-1));
  controls.querySelector(".next")?.addEventListener("click", () => step(1));

  list.addEventListener("touchstart", (event) => {
    touchStartX = event.changedTouches?.[0]?.clientX || 0;
  }, { passive: true });

  list.addEventListener("touchend", (event) => {
    const touchEndX = event.changedTouches?.[0]?.clientX || 0;
    const delta = touchEndX - touchStartX;
    if (Math.abs(delta) < 30) return;
    step(delta < 0 ? 1 : -1);
  }, { passive: true });

  window.addEventListener("resize", () => render(true));

  render(true);

  return {
    refresh(resetIndex = false) {
      render(resetIndex);
    }
  };
}
