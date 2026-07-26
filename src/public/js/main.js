document.addEventListener("DOMContentLoaded", () => {
  const loadingOverlay = document.getElementById("loading-overlay");
  const loadingText = document.getElementById("loading-text");
  const searchInputOnLoad = document.getElementById("search-input");
  const savedTags = sessionStorage.getItem("lastSearchTags");
  const navigationEntries = performance.getEntriesByType("navigation");

  const showLoader = (message = "Loading Contents...") => {
    if (loadingOverlay && loadingText) {
      loadingText.textContent = message;
      loadingOverlay.classList.remove("opacity-0", "pointer-events-none");
    }
  };

  const hideLoader = () => {
    if (loadingOverlay) {
      setTimeout(() => {
        loadingOverlay.classList.add("opacity-0", "pointer-events-none");
      }, 100);
    }
  };

  if (savedTags && searchInputOnLoad) searchInputOnLoad.value = savedTags;

  if (navigationEntries.length > 0 && navigationEntries[0].type === "reload")
    showLoader("Reloading...");

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
  const homeLink = document.getElementById("home-link");
  const homeLinkMobile = document.getElementById("home-link-mobile");
  const brandLink = document.getElementById("brand-link");

  const customAlert = document.getElementById("custom-alert");
  const customAlertTitle = document.getElementById("custom-alert-title");
  const customAlertMessage = document.getElementById("custom-alert-message");
  const customAlertClose = document.getElementById("custom-alert-close");
  const customAlertOverlay = document.getElementById("custom-alert-overlay");
  const customAlertConfirm = document.getElementById("custom-alert-confirm");
  const customAlertCancel = document.getElementById("custom-alert-cancel");

  const scrollToTopBtn = document.getElementById("scroll-to-top-btn");

  let activeSuggestionIndex = -1;
  let onConfirmCallback = null;
  let isInitializingFilters = true;

  // === BAGIAN 2: FUNGSI-FUNGSI UTAMA ===

  const showAlert = (title, message, onConfirm) => {
    if (!customAlert) return;
    customAlertTitle.textContent = title;
    customAlertMessage.textContent = message;

    onConfirmCallback = typeof onConfirm === "function" ? onConfirm : null;

    if (onConfirmCallback) {
      customAlertConfirm.classList.remove("hidden");
      customAlertCancel.classList.remove("hidden");
    } else {
      customAlertConfirm.classList.add("hidden");
      customAlertCancel.classList.add("hidden");
    }

    customAlert.classList.remove("hidden", "opacity-0");
    document.body.classList.add("body-no-scroll");
  };

  const scrollToBottomBtn = document.getElementById("scroll-to-bottom-btn");

  if (scrollToTopBtn) {
    window.addEventListener("scroll", () => {
      if (window.scrollY > 300)
        scrollToTopBtn.classList.remove("opacity-0", "pointer-events-none");
      else scrollToTopBtn.classList.add("opacity-0", "pointer-events-none");
      
      if (scrollToBottomBtn) {
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 300) {
           scrollToBottomBtn.classList.add("opacity-0", "pointer-events-none");
        } else {
           scrollToBottomBtn.classList.remove("opacity-0", "pointer-events-none");
        }
      }
    });

    scrollToTopBtn.addEventListener("click", () =>
      window.scrollTo({ top: 0, behavior: "smooth" })
    );
  }
  
  if (scrollToBottomBtn) {
    scrollToBottomBtn.addEventListener("click", () =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    );
  }

  const hideAlert = () => {
    if (!customAlert) return;
    customAlert.classList.add("hidden", "opacity-0");
    onConfirmCallback = null;

    if (sidebar && sidebar.classList.contains("translate-x-full")) {
      document.body.classList.remove("body-no-scroll");
    }
  };

  const isMobile = () => window.innerWidth < 768;

  const navigateWithFilters = (userTypedTags = "", page = 1) => {
    sessionStorage.setItem("lastSearchTags", userTypedTags.trim());

    const params = new URLSearchParams();
    const filters = JSON.parse(localStorage.getItem("cytusGalleryFilters"));

    if (userTypedTags) params.append("tags", userTypedTags.trim());

    let filterQueryParts = [];
    let limit = 25;
    let lazyload = false;

    if (filters) {
      if (filters.ratingToggle && filters.rating && filters.rating !== "all") {
        let ratingTag =
          filters.rating === "moderate"
            ? "-rating:q"
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
    if (filterQuery) params.append("query", filterQuery);

    params.append("limit", limit);
    if (lazyload) params.append("lazyload", "true");
    if (page > 1) params.append("page", page);
    const queryString = params.toString();
    window.location.href = queryString ? `/search?${queryString}` : "/";
  };

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
      infiniteScrollToggle: document.getElementById("infinite-scroll-toggle") ? document.getElementById("infinite-scroll-toggle").checked : false,
      themeToggle: document.getElementById("theme-toggle") ? document.getElementById("theme-toggle").checked : false,
    };
    localStorage.setItem("cytusGalleryFilters", JSON.stringify(filters));
  };

  const loadFiltersToUI = () => {
    if (!filterForm) return;
    const filters = JSON.parse(localStorage.getItem("cytusGalleryFilters"));
    if (!filters) return;
    if (filters.rating === "not_e" || filters.rating === "not_g") {
      filters.rating = "all";
      localStorage.setItem("cytusGalleryFilters", JSON.stringify(filters));
    }
    const {
      ratingToggle,
      rating,
      typeToggle,
      type,
      limit,
      autoplayToggle,
      lazyloadToggle,
      infiniteScrollToggle,
      themeToggle,
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
    const isToggleEl = document.getElementById("infinite-scroll-toggle");
    if (isToggleEl) isToggleEl.checked = infiniteScrollToggle || false;
    document.body.className = document.body.className.replace(
      /\btheme-\S+/g,
      ""
    );
    if (ratingToggle && rating) {
      if (rating === "g") document.body.classList.add("theme-safe");
      if (rating === "moderate") document.body.classList.add("theme-moderate");
    }
    
    const themeToggleEl = document.getElementById("theme-toggle");
    if (themeToggleEl) {
      themeToggleEl.checked = themeToggle || false;
      if (themeToggleEl.checked) document.body.classList.add("light-mode");
      else document.body.classList.remove("light-mode");
    }
  };

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
      if (customAlert && customAlert.classList.contains("hidden")) {
        document.body.classList.remove("body-no-scroll");
      }
    }
  };

  const closeAllOverlays = () => {
    galleryItems.forEach((item) => {
      item.classList.remove("mobile-active");
      playStopVideo(item, "stop");
    });
  };

  const setActiveSuggestion = () => {
    if (!suggestionsBox) return;
    const suggestions = suggestionsBox.querySelectorAll("a");
    suggestions.forEach((item, index) => {
      item.classList.toggle("bg-gray-700", index === activeSuggestionIndex);
    });
  };

  const playStopVideo = (item, option) => {
    if (item.dataset.isVideo !== "true") return;

    const imgPreview = item.querySelector(".video-preview");
    const videoElement = item.querySelector(".video-playback");
    const videoUrl = item.dataset.videoUrl;

    if (option == "play") {
      // if (imgPreview) imgPreview.classList.add("hidden");
      if (videoElement) {
        if (!videoElement.src && videoUrl) videoElement.src = videoUrl;

        videoElement.onplaying = () => {
          if (imgPreview) imgPreview.classList.add("hidden");
          videoElement.classList.remove("hidden");
        };

        var playPromise = videoElement.play();
        if (playPromise !== undefined) playPromise.catch((_) => {});
      }
    } else {
      if (videoElement) {
        videoElement.pause();
        videoElement.currentTime = 0;
        videoElement.classList.add("hidden");
        videoElement.onplaying = null;
      }

      if (imgPreview) imgPreview.classList.remove("hidden");
    }
  };

  if (sessionStorage.getItem("isLoading") === "true") {
    showLoader("Loading Contents...");
    sessionStorage.removeItem("isLoading");
  }

  if (filterForm) loadFiltersToUI();

  // Sembunyikan loader HANYA setelah semua aset (gambar, dll) selesai dimuat
  window.addEventListener("load", hideLoader);

  // Ganti event listener 'pageshow' yang lama dengan yang ini:
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      showLoader("Reloading Contents...");

      const checkIntervalTime = 100;
      const maxWaitTime = 3000;
      let elapsed = 0;

      const intervalId = setInterval(() => {
        const mediaElements = document.querySelectorAll("#main-gallery img");

        if (mediaElements.length === 0) {
          clearInterval(intervalId);
          hideLoader();
          return;
        }

        // Cek apakah SEMUA gambar sudah complete
        const allMediaReady = Array.from(mediaElements).every(
          (media) => media.complete && media.naturalHeight !== 0
        );

        elapsed += checkIntervalTime;

        if (allMediaReady || elapsed >= maxWaitTime) {
          clearInterval(intervalId);
          hideLoader();
        }
      }, checkIntervalTime);
    } else hideLoader();
  });

  // === BAGIAN 3: MEMASANG SEMUA EVENT LISTENER ===

  function loadFilterHideAlert() {
    loadFiltersToUI();
    hideAlert();
  }

  if (
    customAlertClose ||
    customAlertOverlay ||
    customAlertCancel ||
    customAlertConfirm
  ) {
    customAlertClose.addEventListener("click", () => loadFilterHideAlert());
    customAlertOverlay.addEventListener("click", () => loadFilterHideAlert());
    customAlertCancel.addEventListener("click", () => loadFilterHideAlert());
    customAlertConfirm.addEventListener("click", () => {
      if (onConfirmCallback) onConfirmCallback();
      hideAlert();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !customAlert.classList.contains("hidden"))
      loadFilterHideAlert();
  });

  if (filterForm) {
    filterForm.addEventListener("change", (e) => {
      if (isInitializingFilters) return;
      const changedElement = e.target;

      // Case 1: Menonaktifkan filter rating
      if (changedElement.id === "rating-toggle" && !changedElement.checked) {
        // Cek apakah peringatan ini sudah pernah ditampilkan di sesi ini
        if (sessionStorage.getItem("ratingFilterWarningShown") === "true") {
          saveFilters(); // Jika sudah, langsung simpan tanpa menampilkan alert
        } else {
          // Jika belum, tampilkan alert
          const confirmAction = () => {
            saveFilters();
            // Tandai bahwa alert sudah ditampilkan untuk sesi ini
            sessionStorage.setItem("ratingFilterWarningShown", "true");
          };
          showAlert(
            "Nonaktifkan Filter Rating?",
            "Ini akan menampilkan semua jenis konten, termasuk yang bersifat dewasa. Lanjutkan?",
            confirmAction
          );
        }
      }

      // Case 2: Mengaktifkan filter explicit
      else if (
        changedElement.name === "rating" &&
        changedElement.value === "not_g" &&
        changedElement.checked
      ) {
        // Cek apakah peringatan ini sudah pernah ditampilkan di sesi ini
        if (sessionStorage.getItem("explicitWarningShown") === "true") {
          saveFilters(); // Jika sudah, langsung simpan
        } else {
          // Jika belum, tampilkan alert
          const confirmAction = () => {
            saveFilters();
            // Tandai bahwa alert sudah ditampilkan untuk sesi ini
            sessionStorage.setItem("explicitWarningShown", "true");
          };
          showAlert(
            "Aktifkan Mode Explicit?",
            "Konten dewasa akan ditampilkan. Pastikan Anda berada di lingkungan yang sesuai. Lanjutkan?",
            confirmAction
          );
        }
      }

      // Case 3: Untuk semua perubahan lain yang tidak butuh konfirmasi
      else {
        saveFilters(); // Langsung simpan seperti biasa
      }
    });

    filterForm.addEventListener("submit", (e) => {
      e.preventDefault();
      showLoader("Applying Settings...");
      navigateWithFilters(searchInput.value, 1);
    });

    loadFiltersToUI();
    isInitializingFilters = false;

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

    document
      .getElementById("theme-toggle")
      ?.addEventListener("change", (e) => {
        if (e.target.checked) document.body.classList.add("light-mode");
        else document.body.classList.remove("light-mode");
      });
  }

  const hiddenSearchInput = document.getElementById("hidden-search-input");
  const tagsContainer = document.getElementById("tags-container");

  const syncHiddenInput = () => {
    if (!hiddenSearchInput || !tagsContainer) return;
    const chips = Array.from(tagsContainer.querySelectorAll(".search-chip")).map(c => c.dataset.tag);
    const typed = searchInput ? searchInput.value.trim() : "";
    if (typed) chips.push(typed);
    hiddenSearchInput.value = chips.join(" ");
  };

  const createChip = (tag) => {
    if (!tag || !tagsContainer) return;
    tag = tag.toLowerCase().replace(/\s+/g, '_');
    const existing = Array.from(tagsContainer.querySelectorAll(".search-chip")).find(c => c.dataset.tag === tag);
    if (existing) return;
    const chip = document.createElement("span");
    chip.className = "bg-cyan-700 text-white px-2 py-0.5 rounded-md text-sm flex items-center gap-1 search-chip";
    chip.dataset.tag = tag;
    chip.innerHTML = `${tag.replace(/_/g, ' ')} <button type="button" class="hover:text-red-300 font-bold ml-1 remove-chip-btn">&times;</button>`;
    tagsContainer.appendChild(chip);
  };

  if (tagsContainer) {
    tagsContainer.addEventListener("click", (e) => {
      if (e.target.closest(".remove-chip-btn")) {
        e.preventDefault();
        const chip = e.target.closest(".search-chip");
        if (chip) chip.remove();
        syncHiddenInput();
        if (searchInput) searchInput.focus();
      }
    });
  }

  const saveRecentSearch = (tags) => {
    if (!tags) return;
    let recents = JSON.parse(localStorage.getItem('cytusGalleryRecentSearches') || '[]');
    recents = recents.filter(t => t !== tags);
    recents.unshift(tags);
    if (recents.length > 5) recents.pop();
    localStorage.setItem('cytusGalleryRecentSearches', JSON.stringify(recents));
  };

  const showRecentSearches = () => {
    const recents = JSON.parse(localStorage.getItem('cytusGalleryRecentSearches') || '[]');
    if (recents.length === 0) {
      if (suggestionsBox) suggestionsBox.classList.add("hidden");
      return;
    }
    if (!suggestionsBox) return;
    suggestionsBox.innerHTML = '<div class="px-4 py-2 text-xs text-gray-400 uppercase tracking-wider">Pencarian Terakhir</div>';
    recents.forEach(tag => {
      const item = document.createElement("a");
      item.href = "#";
      item.className = "flex justify-between items-center px-4 py-2 hover:bg-gray-700 text-white cursor-pointer gap-2";
      item.innerHTML = `<span class="truncate text-gray-300">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline-block mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        ${tag}</span>
        <button type="button" class="text-gray-500 hover:text-red-400 p-1 remove-recent-btn" data-tag="${tag}">&times;</button>`;
      
      item.addEventListener("click", (e) => {
        if (e.target.closest(".remove-recent-btn")) {
          e.preventDefault();
          e.stopPropagation();
          const tagToRemove = e.target.closest(".remove-recent-btn").dataset.tag;
          let r = JSON.parse(localStorage.getItem('cytusGalleryRecentSearches') || '[]');
          r = r.filter(t => t !== tagToRemove);
          localStorage.setItem('cytusGalleryRecentSearches', JSON.stringify(r));
          showRecentSearches();
          return;
        }
        e.preventDefault();
        saveRecentSearch(tag);
        navigateWithFilters(tag, 1);
      });
      suggestionsBox.appendChild(item);
    });
    suggestionsBox.classList.remove("hidden");
  };

  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      syncHiddenInput();
      const tags = hiddenSearchInput ? hiddenSearchInput.value : "";
      if (tags) saveRecentSearch(tags);
      showLoader("Searching...");
      navigateWithFilters(tags, 1);
    });
  }

  if (searchInput) {
    searchInput.addEventListener("focus", () => {
      if (!searchInput.value.trim()) showRecentSearches();
    });

    searchInput.addEventListener("input", debounce(async () => {
      const currentTerm = searchInput.value.trim();
      
      if (searchInput.value.endsWith(" ")) {
        if (currentTerm) {
           createChip(currentTerm);
           searchInput.value = "";
           syncHiddenInput();
           suggestionsBox.classList.add("hidden");
        }
        return;
      }

      activeSuggestionIndex = -1;

      if (currentTerm.length < 2) {
        if (currentTerm.length === 0) showRecentSearches();
        else suggestionsBox.classList.add("hidden");
        return;
      }

      try {
        const response = await fetch(`/api/tagsuggest?term=${currentTerm}`);
        const tags = await response.json();

        suggestionsBox.innerHTML = "";

        if (tags.length > 0) {
          tags.forEach((tag) => {
            const suggestionItem = document.createElement("a");
            suggestionItem.href = "#";
            suggestionItem.className =
              "flex justify-between items-center px-4 py-2 hover:bg-gray-700 text-white rounded-md cursor-pointer gap-2";

            const postCount = tag.post_count.toLocaleString("en-US");
            suggestionItem.innerHTML = `<span class="truncate">${tag.name}</span><span class="text-sm text-gray-400 whitespace-nowrap">${postCount}</span>`;

            suggestionItem.addEventListener("click", (e) => {
              e.preventDefault();
              createChip(tag.name);
              searchInput.value = "";
              syncHiddenInput();

              suggestionsBox.classList.add("hidden");
              suggestionsBox.innerHTML = "";
              searchInput.focus();
            });

            suggestionsBox.appendChild(suggestionItem);
          });
          suggestionsBox.classList.remove("hidden");
        } else {
          suggestionsBox.classList.add("hidden");
        }
      } catch (error) {
        console.error("Failed to fetch suggestions:", error);
      }
    }, 300));

    document.addEventListener("keyup", (e) => {
      // Abaikan jika pengguna sedang mengetik di input
      if (document.activeElement.tagName === "INPUT") return;
      // Abaikan jika ada overlay yang aktif
      if (
        !customAlert.classList.contains("hidden") ||
        !sidebar.classList.contains("translate-x-full")
      )
        return;

      if (e.key === "ArrowLeft") {
        const prevButton = document.querySelector('a[rel="prev"]');
        if (prevButton) prevButton.click();
      } else if (e.key === "ArrowRight") {
        const nextButton = document.querySelector('a[rel="next"]');
        if (nextButton) nextButton.click();
      }
    });

    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && searchInput.value === "") {
        if (tagsContainer) {
          const chips = tagsContainer.querySelectorAll(".search-chip");
          if (chips.length > 0) {
            chips[chips.length - 1].remove();
            syncHiddenInput();
            showRecentSearches();
          }
        }
        return;
      }
      
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
      } else if (e.key === "Enter" && activeSuggestionIndex > -1) {
        e.preventDefault();
        suggestions[activeSuggestionIndex].click();
      }
    });
  }

  openSidebarButton.addEventListener("click", openSidebar);
  closeSidebarButton.addEventListener("click", closeSidebar);
  sidebarOverlay.addEventListener("click", closeSidebar);

  // Fungsi terpusat untuk menangani klik link "Home"
  const handleHomeLinkClick = (e) => {
    e.preventDefault();

    const searchInput = document.getElementById("search-input");
    if (searchInput) searchInput.value = "";
    sessionStorage.removeItem("lastSearchTags");

    const currentPath = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);

    if (
      currentPath === "/search" &&
      !searchParams.has("tags") &&
      !searchParams.has("page")
    ) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (isMobile()) closeSidebar();
    } else {
      sessionStorage.setItem("isLoading", "true");
      showLoader("Navigating...");
      navigateWithFilters("", 1);
    }
  };

  // Terapkan listener ke kedua link "Home"
  if (homeLink) homeLink.addEventListener("click", handleHomeLinkClick);
  if (homeLinkMobile)
    homeLinkMobile.addEventListener("click", handleHomeLinkClick);
  if (brandLink) brandLink.addEventListener("click", handleHomeLinkClick);

  galleryItems.forEach((item) => {
    const settings = JSON.parse(localStorage.getItem("cytusGalleryFilters"));

    item.addEventListener("mouseenter", () => {
      if (isMobile()) return;
      if (settings && settings.autoplayToggle) playStopVideo(item, "play");
    });

    item.addEventListener("mouseleave", () => {
      if (isMobile()) return;
      playStopVideo(item, "stop");
    });
  });

  // Listener untuk semua form submit
  const handleFormSubmit = (e) => {
    e.preventDefault();
    sessionStorage.setItem("isLoading", "true");
    navigateWithFilters(document.getElementById("search-input").value, 1);
  };

  if (filterForm) filterForm.addEventListener("submit", handleFormSubmit);
  if (searchForm) searchForm.addEventListener("submit", handleFormSubmit);

  document.addEventListener("click", (e) => {
    if (searchForm && !searchForm.contains(e.target) && suggestionsBox)
      suggestionsBox.classList.add("hidden");

    const link = e.target.closest("a");
    const isDetailButton = link && link.classList.contains("detail-button");
    
    if (isDetailButton) {
      showLoader("Getting Data Content...");
      return;
    }

    if (isMobile()) {
      const clickedItem = e.target.closest(".gallery-item");
      if (!clickedItem) closeAllOverlays();
      else {
        e.preventDefault();

        const isCurrentlyActive =
          clickedItem.classList.contains("mobile-active");
        closeAllOverlays();

        if (!isCurrentlyActive) {
          clickedItem.classList.add("mobile-active");
          const settings = JSON.parse(
            localStorage.getItem("cytusGalleryFilters")
          );
          if (settings && settings.autoplayToggle)
            playStopVideo(clickedItem, "play");
        }
      }
    }

    if (!link) return;

    // Cek jika link adalah salah satu yang memicu loading
    const isPaginationLink = link.closest("#pagination-nav");
    const isSuggestionLink = link.closest("#suggestions-box");
    const isTagLink = link.classList.contains("tag-link");

    if (isPaginationLink || isSuggestionLink || isTagLink) {
      e.preventDefault();
      showLoader("Navigating...");
      sessionStorage.setItem("isLoading", "true");
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
  });

  if (document.querySelector(".swiper")) {
    new Swiper(".swiper", {
      loop: true,
      slidesPerView: 1,
      spaceBetween: 10,
      autoplay: {
        delay: 4000,
        disableOnInteraction: false,
        pauseOnMouseEnter: true,
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
  
  // Infinite Scroll Logic
  const initInfiniteScroll = () => {
    const filters = JSON.parse(localStorage.getItem('cytusGalleryFilters') || '{}');
    if (!filters.infiniteScrollToggle) return;

    const gallery = document.getElementById('main-gallery');
    const paginationNav = document.getElementById('pagination-nav');
    if (!gallery || !paginationNav) return;

    paginationNav.style.display = 'none';
    
    let currentPage = parseInt(new URLSearchParams(window.location.search).get('page') || '1');
    let isLoadingNextPage = false;
    let hasMorePages = true;

    const loaderEl = document.createElement('div');
    loaderEl.id = 'infinite-loader';
    loaderEl.className = 'w-full text-center py-4 text-gray-400 hidden col-span-2 md:col-span-5';
    loaderEl.innerHTML = '<svg class="animate-spin h-6 w-6 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
    gallery.appendChild(loaderEl);

    window.addEventListener('scroll', async () => {
      if (isLoadingNextPage || !hasMorePages) return;
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 800) {
        isLoadingNextPage = true;
        currentPage++;
        loaderEl.classList.remove('hidden');

        try {
          const url = new URL(window.location.href);
          url.searchParams.set('page', currentPage);
          const res = await fetch(url.toString());
          const html = await res.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');

          const newItems = doc.querySelectorAll('#main-gallery .gallery-item');
          if (newItems.length === 0) {
            hasMorePages = false;
          } else {
            newItems.forEach(item => {
              gallery.insertBefore(item, loaderEl);
              if (filters.autoplayToggle) {
                const isVideo = item.getAttribute("data-is-video") === "true";
                if (isVideo) {
                  item.addEventListener("mouseenter", playVideo);
                  item.addEventListener("mouseleave", stopVideo);
                  item.addEventListener("touchstart", playVideo, { passive: true });
                  item.addEventListener("touchend", stopVideo, { passive: true });
                }
              }
            });
          }
        } catch (e) {
          console.error("Infinite scroll error:", e);
        } finally {
          isLoadingNextPage = false;
          loaderEl.classList.add('hidden');
        }
      }
    });
  };

  initInfiniteScroll();
});

window.addEventListener("load", () => {
  const loadingOverlay = document.getElementById("loading-overlay");
  const hideLoader = () => {
    if (loadingOverlay) {
      setTimeout(() => {
        loadingOverlay.classList.add("opacity-0", "pointer-events-none");
      }, 100);
    }
  };
  hideLoader();
});
