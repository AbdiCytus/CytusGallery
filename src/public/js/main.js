document.addEventListener("DOMContentLoaded", () => {
  // === BAGIAN 1: PENGUMPULAN ELEMEN DOM ===
  const searchForm = document.getElementById("search-form");
  const searchInput = document.getElementById("search-input");
  const suggestionsBox = document.getElementById("suggestions-box");
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebar-overlay");
  const openSidebarButton = document.getElementById("open-sidebar-button");
  const closeSidebarButton = document.getElementById("close-sidebar-button");
  const filterForm = document.getElementById("filter-form");
  const galleryItems = document.querySelectorAll(".gallery-item");
  let activeSuggestionIndex = -1;

  // === BAGIAN 2: FUNGSI-FUNGSI UTAMA ===

  /** Fungsi bantu untuk mendeteksi perangkat mobile */
  const isMobile = () => window.innerWidth < 768;

  /** Fungsi terpusat untuk membangun URL dan melakukan navigasi dengan semua filter aktif */
  const navigateWithFilters = (userTypedTags = "", page = 1) => {
    const params = new URLSearchParams();
    const filters = JSON.parse(localStorage.getItem("cytusGalleryFilters"));

    if (userTypedTags) {
      params.append("tags", userTypedTags.trim().replace(/\s+/g, "_"));
    }

    let filterQueryParts = [];
    let limit = 25;
    let lazyload = false;

    if (filters) {
      if (filters.ratingToggle && filters.rating && filters.rating !== "all") {
        let ratingTag =
          filters.rating === "not_g"
            ? "-rating:g"
            : filters.rating === "not_e"
            ? "-rating:e"
            : `rating:${filters.rating}`;
        filterQueryParts.push(ratingTag);
      }
      if (filters.typeToggle && filters.type) {
        let typeTag = "";
        if (filters.type === "image")
          typeTag = "filetype:jpg,jpeg,png,webp,gif,avif";
        if (filters.type === "video") typeTag = "filetype:mp4,webm";
        if (typeTag) filterQueryParts.push(typeTag);
      }
      limit = filters.limit || 25;
      lazyload = filters.lazyloadToggle;
    }

    const filterQuery = filterQueryParts.join(" ");
    if (filterQuery) {
      params.append("query", filterQuery);
    }

    params.append("limit", limit);
    if (lazyload) params.append("lazyload", "true");
    if (page > 1) params.append("page", page);

    const queryString = params.toString();
    window.location.href = queryString ? `/search?${queryString}` : "/";
  };

  /** Menyimpan semua pengaturan dari sidebar ke localStorage */
  const saveFilters = () => {
    if (!filterForm) return;
    const formData = new FormData(filterForm);
    const filters = {
      ratingToggle: document.getElementById("rating-toggle").checked,
      rating: formData.get("rating"),
      typeToggle: document.getElementById("type-toggle").checked,
      type: formData.get("type"),
      limit: document.getElementById("limit-input").value,
      autoplayToggle: document.getElementById("autoplay-toggle").checked,
      lazyloadToggle: document.getElementById("lazyload-toggle").checked,
    };
    localStorage.setItem("cytusGalleryFilters", JSON.stringify(filters));
  };

  /** Memuat semua pengaturan dari localStorage dan menerapkannya ke UI sidebar */
  const loadFiltersToUI = () => {
    if (!filterForm) return;
    const filters = JSON.parse(localStorage.getItem("cytusGalleryFilters"));
    if (!filters) return;

    const {
      ratingToggle,
      rating,
      typeToggle,
      type,
      limit,
      autoplayToggle,
      lazyloadToggle,
    } = filters;

    const ratingToggleEl = document.getElementById("rating-toggle");
    if (ratingToggleEl) {
      ratingToggleEl.checked = ratingToggle;
      document
        .getElementById("rating-options")
        .classList.toggle("hidden", !ratingToggle);
      if (rating) {
        const ratingInput = document.querySelector(
          `input[name="rating"][value="${rating}"]`
        );
        if (ratingInput) ratingInput.checked = true;
      }
    }

    const typeToggleEl = document.getElementById("type-toggle");
    if (typeToggleEl) {
      typeToggleEl.checked = typeToggle;
      document
        .getElementById("type-options")
        .classList.toggle("hidden", !typeToggle);
      if (type) {
        const typeInput = document.querySelector(
          `input[name="type"][value="${type}"]`
        );
        if (typeInput) typeInput.checked = true;
      }
    }

    document.getElementById("limit-input").value = limit || 25;
    document.getElementById("autoplay-toggle").checked = autoplayToggle;
    document.getElementById("lazyload-toggle").checked = lazyloadToggle;

    document.body.className = document.body.className.replace(
      /\btheme-\S+/g,
      ""
    );
    if (ratingToggle && rating) {
      if (rating === "g") document.body.classList.add("theme-safe");
      if (rating === "not_e") document.body.classList.add("theme-moderate");
      if (rating === "not_g") document.body.classList.add("theme-explicit");
    }
  };

  /** Fungsi untuk membuka dan menutup sidebar */
  const openSidebar = () => {
    if (sidebar && sidebarOverlay) {
      sidebar.classList.remove("translate-x-full");
      sidebarOverlay.classList.remove("opacity-0", "pointer-events-none");
      document.body.classList.add("body-no-scroll");
    }
  };
  const closeSidebar = () => {
    if (sidebar && sidebarOverlay) {
      sidebar.classList.add("translate-x-full");
      sidebarOverlay.classList.add("opacity-0", "pointer-events-none");
      document.body.classList.remove("body-no-scroll");
    }
  };

  /** Fungsi untuk interaksi video */
  // const playVideo = (item) => {
  //   const mediaContainer = item.querySelector(".media-container");
  //   if (!mediaContainer || item.dataset.isVideo !== "true") return;
  //   const imgPreview = mediaContainer.querySelector("img");
  //   let videoElement = item.querySelector("video");
  //   if (!videoElement) {
  //     videoElement = document.createElement("video");
  //     videoElement.src = item.dataset.videoUrl;
  //     videoElement.className = "w-full h-full object-cover";
  //     videoElement.muted = true;
  //     videoElement.playsInline = true;
  //     mediaContainer.appendChild(videoElement);
  //   }
  //   if (imgPreview) imgPreview.style.display = "none";
  //   videoElement.style.display = "block";
  //   videoElement.currentTime = 0;
  //   videoElement.play().catch((e) => {});
  //   const loopFiveSeconds = () => {
  //     if (videoElement.currentTime >= 5) {
  //       videoElement.currentTime = 0;
  //       videoElement.play().catch((e) => {});
  //     }
  //   };
  //   videoElement.addEventListener("timeupdate", loopFiveSeconds);
  //   item.videoLoopListener = loopFiveSeconds;
  // };

  // const stopVideo = (item) => {
  //   const videoElement = item.querySelector("video");
  //   const imgPreview = item.querySelector(".media-container img");
  //   if (videoElement) {
  //     videoElement.pause();
  //     if (item.videoLoopListener) {
  //       videoElement.removeEventListener("timeupdate", item.videoLoopListener);
  //     }
  //     videoElement.style.display = "none";
  //   }
  //   if (imgPreview) imgPreview.style.display = "block";
  // };

  const closeAllOverlays = () => {
    galleryItems.forEach((item) => {
      item.classList.remove("mobile-active");
      stopVideo(item);
    });
  };

  /** Fungsi untuk auto-suggest */
  const setActiveSuggestion = () => {
    if (!suggestionsBox) return;
    const suggestions = suggestionsBox.querySelectorAll("a");
    suggestions.forEach((item, index) => {
      if (index === activeSuggestionIndex) {
        item.classList.add("bg-gray-700");
      } else {
        item.classList.remove("bg-gray-700");
      }
    });
  };

  // === BAGIAN 3: MEMASANG SEMUA EVENT LISTENER ===

  // 1. Inisialisasi Aplikasi
  if (filterForm) {
    loadFiltersToUI();
    document
      .getElementById("rating-toggle")
      ?.addEventListener("change", (e) =>
        document
          .getElementById("rating-options")
          ?.classList.toggle("hidden", !e.target.checked)
      );
    document
      .getElementById("type-toggle")
      ?.addEventListener("change", (e) =>
        document
          .getElementById("type-options")
          ?.classList.toggle("hidden", !e.target.checked)
      );
  }

  // 2. Listener untuk semua form
  if (filterForm) {
    filterForm.addEventListener("change", saveFilters);
    filterForm.addEventListener("submit", (e) => {
      e.preventDefault();
      navigateWithFilters(searchInput.value, 1);
    });
  }
  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      navigateWithFilters(searchInput.value, 1);
    });
  }

  // 3. Listener untuk auto-suggest
  if (searchInput) {
    searchInput.addEventListener("input", async () => {
      const term = searchInput.value;
      activeSuggestionIndex = -1;
      if (term.length < 2) {
        suggestionsBox.classList.add("hidden");
        return;
      }
      try {
        const response = await fetch(`/api/tagsuggest?term=${term}`);
        const tags = await response.json();
        suggestionsBox.innerHTML = "";
        if (tags.length > 0) {
          tags.forEach((tag) => {
            const suggestionItem = document.createElement("a");
            suggestionItem.href = `/search?tags=${tag.name}`;
            suggestionItem.className =
              "block px-4 py-2 hover:bg-gray-700 text-white rounded-md";
            const postCount = tag.post_count.toLocaleString("en-US");
            suggestionItem.innerHTML = `<span>${tag.name}</span><span class="text-sm text-gray-400 float-right">${postCount}</span>`;
            suggestionsBox.appendChild(suggestionItem);
          });
          suggestionsBox.classList.remove("hidden");
        } else {
          suggestionsBox.classList.add("hidden");
        }
      } catch (error) {
        console.error("Failed to fetch suggestions:", error);
      }
    });
    searchInput.addEventListener("keydown", (e) => {
      const suggestions = suggestionsBox.querySelectorAll("a");
      if (
        suggestions.length === 0 ||
        suggestionsBox.classList.contains("hidden")
      )
        return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        activeSuggestionIndex =
          (activeSuggestionIndex + 1) % suggestions.length;
        setActiveSuggestion();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        activeSuggestionIndex =
          (activeSuggestionIndex - 1 + suggestions.length) % suggestions.length;
        setActiveSuggestion();
      } else if (e.key === "Enter") {
        if (activeSuggestionIndex > -1) {
          e.preventDefault();
          suggestions[activeSuggestionIndex].click();
        }
      }
    });
  }

  // 4. Listener untuk sidebar
  if (openSidebarButton)
    openSidebarButton.addEventListener("click", openSidebar);
  if (closeSidebarButton)
    closeSidebarButton.addEventListener("click", closeSidebar);
  if (sidebarOverlay) sidebarOverlay.addEventListener("click", closeSidebar);

  // 5. Listener untuk interaksi galeri (Desktop)
  galleryItems.forEach((item) => {
    item.addEventListener("mouseenter", () => {
      if (isMobile()) return;
      const settings = JSON.parse(localStorage.getItem("cytusGalleryFilters"));
      if (settings && settings.autoplayToggle) playVideo(item);
    });
    item.addEventListener("mouseleave", () => {
      if (isMobile()) return;
      stopVideo(item);
    });
  });

  // 6. Listener global untuk klik (termasuk interaksi mobile)
  document.addEventListener("click", (e) => {
    // Menutup suggestion box
    if (searchForm && !searchForm.contains(e.target)) {
      if (suggestionsBox) suggestionsBox.classList.add("hidden");
    }

    // Logika untuk Mobile
    if (isMobile()) {
      const clickedItem = e.target.closest(".gallery-item");
      if (!clickedItem) {
        closeAllOverlays();
      } else {
        if (e.target.closest(".detail-button")) return;
        e.preventDefault();
        const isCurrentlyActive =
          clickedItem.classList.contains("mobile-active");
        closeAllOverlays();
        if (!isCurrentlyActive) {
          clickedItem.classList.add("mobile-active");
          const settings = JSON.parse(
            localStorage.getItem("cytusGalleryFilters")
          );
          if (settings && settings.autoplayToggle) {
            playVideo(clickedItem);
          }
        }
      }
    }

    // Mencegat klik link untuk menerapkan filter
    const link = e.target.closest("a");
    if (!link) return;
    const isPaginationLink = link.closest("#pagination-nav");
    const isSuggestionLink = link.closest("#suggestions-box");
    const isTagLink = link.classList.contains("tag-link");
    if (link.href.includes("/search") || link.href.includes("/?page=")) {
      if (isPaginationLink || isSuggestionLink || isTagLink) {
        e.preventDefault();
        const url = new URL(link.href);
        const tags = url.searchParams.get("tags") || "";
        const page = url.searchParams.get("page") || 1;
        const userTags = tags
          .split(" ")
          .filter(
            (t) =>
              !t.startsWith("rating:") &&
              !t.startsWith("-rating:") &&
              !t.startsWith("filetype:")
          )
          .join(" ");
        navigateWithFilters(userTags, page);
      }
    }
  });

  // Ganti fungsi playVideo yang lama dengan ini
  const playVideo = (item) => {
    if (item.dataset.isVideo !== "true") return;
    const imgPreview = item.querySelector(".video-preview");
    const videoElement = item.querySelector(".video-playback");

    if (imgPreview) imgPreview.classList.add("hidden");
    if (videoElement) {
      videoElement.classList.remove("hidden");
      videoElement.currentTime = 0;
      videoElement.play().catch((e) => {});
    }
  };

  // Ganti fungsi stopVideo yang lama dengan ini
  const stopVideo = (item) => {
    if (item.dataset.isVideo !== "true") return;
    const imgPreview = item.querySelector(".video-preview");
    const videoElement = item.querySelector(".video-playback");

    if (videoElement) {
      videoElement.pause();
      videoElement.classList.add("hidden");
    }
    if (imgPreview) imgPreview.classList.remove("hidden");
  };

  // 7. Inisialisasi Swiper
  if (document.querySelector(".swiper")) {
    const swiper = new Swiper(".swiper", {
      loop: true,
      slidesPerView: 1,
      spaceBetween: 10,
      autoplay: {
        delay: 4000,
        disableOnInteraction: false,
        pauseOnMouseEnter: true, // Menjeda autoplay bawaan saat hover
      },
      breakpoints: {
        640: { slidesPerView: 3, spaceBetween: 20 },
        1024: { slidesPerView: 5, spaceBetween: 20 },
      },
      navigation: {
        nextEl: ".swiper-button-next",
        prevEl: ".swiper-button-prev",
      },
    });
  }

  // Seleksi semua elemen yang merupakan slide DAN juga item galeri
  const sliderItems = document.querySelectorAll(".swiper-slide.gallery-item");

  sliderItems.forEach((item) => {
    // Hindari memasang listener berulang kali jika ada
    if (item.listenersAttached) return;

    item.addEventListener("mouseenter", () => {
      if (isMobile()) return;
      const settings = JSON.parse(localStorage.getItem("cytusGalleryFilters"));
      if (settings && settings.autoplayToggle) {
        playVideo(item);
      }
    });

    item.addEventListener("mouseleave", () => {
      if (isMobile()) return;
      stopVideo(item);
    });

    item.listenersAttached = true;
  });
});
