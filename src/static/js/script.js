document.addEventListener("DOMContentLoaded", () => {
  const postContent = document.querySelector(".post-content");
  if (postContent) {
    const textCol = document.createElement("div");
    textCol.className = "post-text-col";
    const imageCol = document.createElement("div");
    imageCol.className = "post-image-col";

    Array.from(postContent.childNodes).forEach(node => {
      if (node.nodeName === "IMG") {
        imageCol.appendChild(node);
      } else {
        textCol.appendChild(node);
      }
    });

    postContent.appendChild(textCol);
    postContent.appendChild(imageCol);
  }

  const draggables = document.querySelectorAll(".draggable");
  let highestZIndex = 1; // Global z-index counter

  draggables.forEach(img => {
    // Prevent default drag behavior
    img.draggable = false;
    
    // randomize start position
    img.style.top = Math.random() * 70 + 10 + "%";
    img.style.left = Math.random() * 70 + 10 + "%";

    let isDragging = false, offsetX, offsetY;

    img.addEventListener("mousedown", e => {
      e.preventDefault(); // Prevent default behavior
      isDragging = true;
      offsetX = e.clientX - img.offsetLeft;
      offsetY = e.clientY - img.offsetTop;
      
      // Increment and assign the highest z-index
      highestZIndex++;
      img.style.zIndex = highestZIndex;
      
      img.style.cursor = "grabbing";
    });

    // Prevent context menu on right-click during drag
    img.addEventListener("contextmenu", e => {
      if (isDragging) {
        e.preventDefault();
      }
    });

    // Prevent drag start event
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

    // Handle mouse leaving window while dragging
    window.addEventListener("mouseleave", () => {
      if (isDragging) {
        isDragging = false;
        img.style.cursor = "grab";
      }
    });

    // Touch support
    img.addEventListener("touchstart", e => {
      e.preventDefault();
      const touch = e.touches[0];
      isDragging = true;
      offsetX = touch.clientX - img.offsetLeft;
      offsetY = touch.clientY - img.offsetTop;
      
      // Increment and assign the highest z-index
      highestZIndex++;
      img.style.zIndex = highestZIndex;
    });

    window.addEventListener("touchmove", e => {
      if (!isDragging) return;
      e.preventDefault();
      const touch = e.touches[0];
      img.style.left = touch.clientX - offsetX + "px";
      img.style.top = touch.clientY - offsetY + "px";
    });

    window.addEventListener("touchend", e => {
      if (isDragging) {
        e.preventDefault();
        isDragging = false;
      }
    });

    window.addEventListener("touchcancel", e => {
      if (isDragging) {
        isDragging = false;
      }
    });
  });
});