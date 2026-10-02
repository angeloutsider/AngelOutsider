document.addEventListener("DOMContentLoaded", () => {
  const overlay = document.getElementById("subscribe-overlay");
  const openBtn = document.getElementById("subscribe-open");
  const closeBtn = document.getElementById("subscribe-close");

  const form = document.getElementById("mc-embedded-subscribe-form");
  const msgEl = document.getElementById("subscribe-msg");

  openBtn?.addEventListener("click", () => {
    overlay.classList.add("active");
    if (msgEl) msgEl.textContent = "";
  });
  closeBtn?.addEventListener("click", () => overlay.classList.remove("active"));
  overlay?.addEventListener("click", e => {
    if (e.target === overlay) overlay.classList.remove("active");
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") overlay?.classList.remove("active");
  });

  form?.addEventListener("submit", function(e) {
    e.preventDefault();
    const email = document.getElementById("mce-EMAIL").value;
    const fname = document.getElementById("mce-FNAME").value;
    const lname = document.getElementById("mce-LNAME").value;
    const callbackName = "_mc_cb_" + Date.now();
    const url = form.action
      + "&EMAIL=" + encodeURIComponent(email)
      + "&FNAME=" + encodeURIComponent(fname)
      + "&LNAME=" + encodeURIComponent(lname)
      + "&b_186537096480d22ea1f8ec6d6_6c0325d046="
      + "&c=" + callbackName;

    window[callbackName] = function(data) {
      delete window[callbackName];
      document.head.removeChild(script);
      if (data.result === "success") {
        form.querySelectorAll("input[type=email], input[type=text]:not([tabindex='-1'])").forEach(el => el.value = "");
        msgEl.textContent = "subscribed!";
        msgEl.className = "subscribe-msg success";
      } else {
        const alreadySubbed = data.msg && data.msg.toLowerCase().includes("already subscribed");
        msgEl.textContent = alreadySubbed ? "already subscribed!" : "something went wrong, try again.";
        msgEl.className = "subscribe-msg error";
      }
    };

    const script = document.createElement("script");
    script.src = url;
    document.head.appendChild(script);
  });

  const postContent = document.querySelector(".post-content");
  if (postContent) {
    // Markdown wraps lone images in <p>; captioned images are <figure>.
    const isImageNode = node =>
      node.nodeName === "IMG" ||
      (node.nodeName === "FIGURE" && !!node.querySelector("img")) ||
      (node.nodeName === "P" &&
        node.children.length === 1 &&
        node.children[0].nodeName === "IMG" &&
        !node.textContent.trim());

    const originalNodes = Array.from(postContent.childNodes);

    // Two columns on wide screens; document order on mobile.
    const wideScreen = window.matchMedia("(min-width: 769px)");

    const applyLayout = () => {
      const isSplit = !!postContent.querySelector(".post-text-col");

      if (wideScreen.matches && !isSplit) {
        const textCol = document.createElement("div");
        textCol.className = "post-text-col";
        const imageCol = document.createElement("div");
        imageCol.className = "post-image-col";
        originalNodes.forEach(node => {
          (isImageNode(node) ? imageCol : textCol).appendChild(node);
        });
        postContent.appendChild(textCol);
        postContent.appendChild(imageCol);
      } else if (!wideScreen.matches && isSplit) {
        originalNodes.forEach(node => postContent.appendChild(node));
        postContent.querySelector(".post-text-col")?.remove();
        postContent.querySelector(".post-image-col")?.remove();
      }
    };

    applyLayout();
    wideScreen.addEventListener("change", applyLayout);
  }

  const draggables = document.querySelectorAll(".draggable");
  let highestZIndex = 1;

  draggables.forEach(img => {
    img.draggable = false;

    img.style.top = Math.random() * 70 + 10 + "%";
    img.style.left = Math.random() * 70 + 10 + "%";

    let isDragging = false, offsetX, offsetY;

    img.addEventListener("mousedown", e => {
      e.preventDefault();
      isDragging = true;
      offsetX = e.clientX - img.offsetLeft;
      offsetY = e.clientY - img.offsetTop;
      highestZIndex++;
      img.style.zIndex = highestZIndex;
      img.style.cursor = "grabbing";
    });

    img.addEventListener("contextmenu", e => {
      if (isDragging) {
        e.preventDefault();
      }
    });

    img.addEventListener("dragstart", e => {
      e.preventDefault();
      return false;
    });

    window.addEventListener("mousemove", e => {
      if (!isDragging) return;
      e.preventDefault();
      img.style.left = e.clientX - offsetX + "px";
      img.style.top = e.clientY - offsetY + "px";
    });

    window.addEventListener("mouseup", () => {
      if (isDragging) {
        isDragging = false;
        img.style.cursor = "grab";
      }
    });

    window.addEventListener("mouseleave", () => {
      if (isDragging) {
        isDragging = false;
        img.style.cursor = "grab";
      }
    });

    // Non-passive so preventDefault blocks scrolling while dragging.
    img.addEventListener("touchstart", e => {
      e.preventDefault();
      const touch = e.touches[0];
      isDragging = true;
      offsetX = touch.clientX - img.offsetLeft;
      offsetY = touch.clientY - img.offsetTop;
      highestZIndex++;
      img.style.zIndex = highestZIndex;
    }, { passive: false });

    window.addEventListener("touchmove", e => {
      if (!isDragging) return;
      e.preventDefault();
      const touch = e.touches[0];
      img.style.left = touch.clientX - offsetX + "px";
      img.style.top = touch.clientY - offsetY + "px";
    }, { passive: false });

    window.addEventListener("touchend", e => {
      if (isDragging) {
        e.preventDefault();
        isDragging = false;
      }
    });

    window.addEventListener("touchcancel", () => {
      if (isDragging) {
        isDragging = false;
      }
    });
  });
});
