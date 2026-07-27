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
  const searchInputVisual = document.getElementById("search-input-visual");
  const searchChipsContainer = document.getElementById("search-chips");
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
  const customAlertOk = document.getElementById("custom-alert-ok");

  const scrollToTopBtn = document.getElementById("scroll-to-top-btn");

  let activeSuggestionIndex = -1;
  let onConfirmCallback = null;
  let isInitializingFilters = true;

  // === BAGIAN 2: FUNGSI-FUNGSI UTAMA ===

  const renderChips = () => {
    if (!searchChipsContainer || !searchInput) return;
    searchChipsContainer.innerHTML = '';
    const tags = searchInput.value.split(' ').filter(t => t.trim());
    tags.forEach(tag => {
      const chip = document.createElement('div');
      chip.className = 'flex items-center bg-cyan-600 text-white px-2 py-1 rounded-full text-sm font-semibold shadow-sm';
      chip.innerHTML = `<span>${tag.replace(/_/g, ' ')}</span><button type="button" class="ml-1 text-cyan-200 hover:text-white" onclick="removeChip('${tag}')">&times;</button>`;
      searchChipsContainer.appendChild(chip);
    });
  };

  window.removeChip = (tagToRemove) => {
    if (!searchInput) return;
    let tags = searchInput.value.split(' ').filter(t => t.trim());
    tags = tags.filter(t => t !== tagToRemove);
    searchInput.value = tags.join(' ');
    renderChips();
    if (searchInputVisual) searchInputVisual.focus();
  };
  
  const addChip = (tag) => {
    if (!searchInput) return;
    let tags = searchInput.value.split(' ').filter(t => t.trim());
    if (!tags.includes(tag)) {
      tags.push(tag);
      searchInput.value = tags.join(' ');
      renderChips();
    }
  };

  if (savedTags && searchInputOnLoad) {
    searchInputOnLoad.value = savedTags;
    renderChips();
  }

  const showAlert = (title, message, onConfirm) => {
    if (!customAlert) return;
    customAlertTitle.textContent = title;
    customAlertMessage.textContent = message;

    const iconWrapper = document.getElementById('custom-alert-icon-wrapper');
    const icon = document.getElementById('custom-alert-icon');
    
    if (iconWrapper && icon) {
      if (title.toLowerCase().includes('berhasil')) {
        iconWrapper.className = 'flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full bg-green-900/50';
        icon.setAttribute('class', 'w-6 h-6 text-green-400');
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>';
      } else {
        iconWrapper.className = 'flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full bg-red-900/50';
        icon.setAttribute('class', 'w-6 h-6 text-red-400');
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>';
      }
    }
    
    if (customAlertConfirm) {
      if (title.toLowerCase().includes('hapus')) {
        customAlertConfirm.textContent = 'Hapus';
        customAlertConfirm.className = 'px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-red-500';
      } else if (title.toLowerCase().includes('nonaktifkan')) {
        customAlertConfirm.textContent = 'Nonaktifkan';
        customAlertConfirm.className = 'px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-500';
      } else {
        customAlertConfirm.textContent = 'Aktifkan';
        customAlertConfirm.className = 'px-4 py-2 bg-cyan-600 text-white text-sm font-medium rounded-md hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-cyan-500';
      }
    }

    onConfirmCallback = typeof onConfirm === "function" ? onConfirm : null;

    if (onConfirmCallback) {
      if (customAlertConfirm) customAlertConfirm.classList.remove("hidden");
      if (customAlertCancel) customAlertCancel.classList.remove("hidden");
      if (customAlertOk) customAlertOk.classList.add("hidden");
    } else {
      if (customAlertConfirm) customAlertConfirm.classList.add("hidden");
      if (customAlertCancel) customAlertCancel.classList.add("hidden");
      if (customAlertOk) customAlertOk.classList.remove("hidden");
    }

    customAlert.classList.remove("hidden", "opacity-0");
    document.body.classList.add("body-no-scroll");
    
    // Add overlay logic if exists
    if (customAlertOverlay) {
        customAlertOverlay.classList.remove("hidden", "opacity-0");
    }
  };
  window.showAlert = showAlert;

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
      let explicitLocked = true;
      const isBypassUser = document.getElementById("rating-e") !== null;

      if (filters.ratingToggle && filters.rating && filters.rating !== "all") {
        if (filters.rating === "not_e") {
          // Moderate only shows Sensitive (s)
          filterQueryParts.push("rating:s");
          explicitLocked = false;
        } else if (filters.rating === "g") {
          filterQueryParts.push("rating:g");
          explicitLocked = false;
        } else if (filters.rating === "e") {
          if (isBypassUser) {
            filterQueryParts.push("rating:e,q");
            explicitLocked = false;
          } else {
            // Force fallback if user logged out but still has 'e' in local storage
            filterQueryParts.push("rating:g");
            explicitLocked = false;
          }
        }
      } else if (!filters.ratingToggle && isBypassUser) {
        // Toggle is off and user has bypass: don't lock explicit
        explicitLocked = false;
      }
      
      if (explicitLocked) {
        // Locked explicit means showing everything except 'e' and 'q'
        filterQueryParts.push("-rating:e");
        filterQueryParts.push("-rating:q");
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

  // Intercept raw tag links (e.g. from profile or other pages) to apply local filters
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (a && a.href && a.href.includes('/search?tags=')) {
      try {
        const url = new URL(a.href);
        if (url.origin === window.location.origin) {
          const tags = url.searchParams.get('tags');
          // If there is no 'query' parameter, it means filters aren't applied yet
          if (tags && !url.searchParams.has('query')) {
            e.preventDefault();
            showLoader("Applying filters...");
            navigateWithFilters(tags, 1);
          }
        }
      } catch (err) {}
    }
  });

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
      scrollToggle: document.getElementById("scroll-toggle") ? document.getElementById("scroll-toggle").checked : false,
      themeToggle: document.getElementById("theme-toggle") ? document.getElementById("theme-toggle").checked : false,
    };
    localStorage.setItem("cytusGalleryFilters", JSON.stringify(filters));
  };

  const loadFiltersToUI = () => {
    if (!filterForm) return;
    let filters = JSON.parse(localStorage.getItem("cytusGalleryFilters"));
    let wasMissing = false;
    if (!filters) {
      filters = {
        ratingToggle: true,
        rating: "g",
        typeToggle: false,
        type: "image",
        limit: "25",
        autoplayToggle: false,
        lazyloadToggle: true,
      };
      localStorage.setItem("cytusGalleryFilters", JSON.stringify(filters));
      wasMissing = true;
    }
    const {
      ratingToggle,
      rating,
      typeToggle,
      type,
      limit,
      autoplayToggle,
      lazyloadToggle,
      scrollToggle,
      themeToggle,
    } = filters;
    const ratingToggleEl = document.getElementById("rating-toggle");
    if (ratingToggleEl) {
      ratingToggleEl.checked = ratingToggle;
      document
        .getElementById("rating-options")
        .classList.toggle("hidden", !ratingToggle);
      if (rating) {
        let actualRating = rating;
        if (actualRating === "e" && document.getElementById("rating-e") === null) {
            actualRating = "g";
            filters.rating = "g";
            localStorage.setItem("cytusGalleryFilters", JSON.stringify(filters));
            wasMissing = true;
        }
        const ratingInput = document.querySelector(
          `input[name="rating"][value="${actualRating}"]`
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
    if (filters.ratingToggle && filters.rating) {
      if (filters.rating === "g") document.body.classList.add("theme-safe");
      if (filters.rating === "not_e") document.body.classList.add("theme-moderate");
      if (filters.rating === "e") document.body.classList.add("theme-explicit");
    }
    
    const scrollToggleEl = document.getElementById("scroll-toggle");
    if (scrollToggleEl) {
      scrollToggleEl.checked = scrollToggle || false;
      const limitInputContainer = document.getElementById("limit-input-container");
      if (limitInputContainer) {
        limitInputContainer.classList.toggle("hidden", scrollToggleEl.checked);
      }
    }
    
    const themeToggleEl = document.getElementById("theme-toggle");
    if (themeToggleEl) {
      themeToggleEl.checked = themeToggle || false;
      if (themeToggleEl.checked) document.body.classList.add("light-mode");
      else document.body.classList.remove("light-mode");
    }

    if (wasMissing && window.location.pathname === '/search') {
      const searchParams = new URLSearchParams(window.location.search);
      const tags = searchParams.get("tags") || "";
      const page = searchParams.get("page") || 1;
      navigateWithFilters(tags, parseInt(page));
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
    document.querySelectorAll(".gallery-item").forEach((item) => {
      item.classList.remove("mobile-active");
      playStopVideo(item, "stop");
    });
  };

  const setActiveSuggestion = () => {
    if (!suggestionsBox) return;
    const suggestions = suggestionsBox.querySelectorAll(".suggestion-item");
    suggestions.forEach((item, index) => {
      item.classList.toggle("bg-gray-700", index === activeSuggestionIndex);
      // Remove bg-gray-700 hover class if it's currently active to override default look
      if (index === activeSuggestionIndex) {
         item.style.backgroundColor = "rgba(55, 65, 81, 1)"; // Tailwind gray-700
      } else {
         item.style.backgroundColor = "";
      }
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

  const initializeMasonry = () => {
    const galleries = document.querySelectorAll('#main-gallery');
    galleries.forEach(gallery => {
      if (gallery.dataset.masonryInitialized) return;
      gallery.dataset.masonryInitialized = 'true';

      gallery.className = "flex gap-4 items-start w-full";
      
      gallery._masonryItems = Array.from(gallery.querySelectorAll('.gallery-item'));
      if (gallery._masonryItems.length === 0) return;

      const getCols = () => {
        if (window.innerWidth >= 1280) return 5;
        if (window.innerWidth >= 1024) return 4;
        if (window.innerWidth >= 768) return 3;
        return 2;
      };

      let cols = getCols();
      let colDivs = [];

      const renderGrid = () => {
        const newCols = getCols();
        if (colDivs.length === newCols) return;
        
        cols = newCols;
        gallery.innerHTML = '';
        colDivs = [];
        
        for (let i = 0; i < cols; i++) {
          const col = document.createElement('div');
          col.className = "flex flex-col gap-4 flex-1 min-w-0";
          gallery.appendChild(col);
          colDivs.push(col);
        }

        const colHeights = new Array(cols).fill(0);
        
        gallery._masonryItems.forEach(item => {
          let minCol = 0;
          let minHeight = colHeights[0];
          for (let i = 1; i < cols; i++) {
            if (colHeights[i] < minHeight) {
              minHeight = colHeights[i];
              minCol = i;
            }
          }
          
          colDivs[minCol].appendChild(item);
          
          const mediaContainer = item.querySelector('.media-container');
          let ratio = 1;
          if (mediaContainer && mediaContainer.style.aspectRatio) {
             const parts = mediaContainer.style.aspectRatio.split('/');
             if (parts.length === 2) {
               ratio = parseFloat(parts[1]) / parseFloat(parts[0]);
             }
          }
          colHeights[minCol] += ratio; 
        });
      };

      gallery.appendMasonryItems = (newItemsList) => {
         newItemsList.forEach(el => gallery._masonryItems.push(el));
         colDivs = []; // force re-render
         renderGrid();
      };

      renderGrid();

      window.addEventListener('resize', () => {
        clearTimeout(gallery.resizeTimer);
        gallery.resizeTimer = setTimeout(renderGrid, 200);
      });
    });
  };

  if (sessionStorage.getItem("isLoading") === "true") {
    showLoader("Loading Contents...");
    sessionStorage.removeItem("isLoading");
  }

  if (filterForm) loadFiltersToUI();
  initializeMasonry();

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
    customAlertConfirm ||
    customAlertOk
  ) {
    if (customAlertClose) customAlertClose.addEventListener("click", () => loadFilterHideAlert());
    if (customAlertOverlay) customAlertOverlay.addEventListener("click", () => loadFilterHideAlert());
    if (customAlertCancel) customAlertCancel.addEventListener("click", () => loadFilterHideAlert());
    if (customAlertOk) customAlertOk.addEventListener("click", () => loadFilterHideAlert());
    if (customAlertConfirm) customAlertConfirm.addEventListener("click", () => {
      if (onConfirmCallback) onConfirmCallback();
      hideAlert();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !customAlert.classList.contains("hidden"))
      loadFilterHideAlert();
  });

  // Profil & Notifikasi Loader
  document.querySelectorAll('a[href="/profil"], a[href="/notifikasi"]').forEach(link => {
    link.addEventListener('click', (e) => {
      // Don't trigger if it opens in a new tab
      if(e.ctrlKey || e.metaKey || link.target === '_blank') return;
      showLoader("Memuat...");
    });
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
      navigateWithFilters(searchInput ? searchInput.value : "", 1);
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

    document
      .getElementById("scroll-toggle")
      ?.addEventListener("change", (e) => {
        document
          .getElementById("limit-input-container")
          ?.classList.toggle("hidden", e.target.checked);
      });
  }

  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      
      // Process any remaining text in visual input as a chip before submitting
      if (searchInputVisual && searchInputVisual.value.trim()) {
         addChip(searchInputVisual.value.trim().replace(/\s+/g, '_'));
         searchInputVisual.value = "";
      }
      
      const tags = searchInput.value.trim();
      
      // Save to recent searches
      if (tags) {
         let recentTags = JSON.parse(localStorage.getItem('recentSearchTags') || '[]');
         const tagArray = tags.split(' ').filter(t => t);
         tagArray.forEach(t => {
            if (!recentTags.includes(t)) {
               recentTags.unshift(t);
            } else {
               recentTags = recentTags.filter(rt => rt !== t);
               recentTags.unshift(t);
            }
         });
         recentTags = recentTags.slice(0, 10);
         localStorage.setItem('recentSearchTags', JSON.stringify(recentTags));
      }
      
      showLoader("Searching...");
      navigateWithFilters(tags, 1);
    });
  }

  const showRecentTags = () => {
    if (searchInput && searchInput.value.trim() !== '') {
       suggestionsBox.classList.add("hidden");
       return;
    }
    let recentTags = JSON.parse(localStorage.getItem('recentSearchTags') || '[]');
    if (recentTags.length > 0) {
      suggestionsBox.innerHTML = '<div class="px-3 py-1 text-xs text-gray-500 font-bold uppercase tracking-wider">Recent Searches</div>';
      recentTags.forEach(tag => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = "flex justify-between w-full items-center px-4 py-2 hover:bg-gray-700 text-gray-300 rounded-md cursor-pointer gap-2 suggestion-item focus:outline-none";
        
        const textSpan = document.createElement('span');
        textSpan.className = "truncate flex-grow text-left";
        textSpan.textContent = tag.replace(/_/g, ' ');
        // For click on the item directly
        item.addEventListener("click", (e) => {
          if (e.target.closest('button')) return; // Ignore if delete button clicked
          e.preventDefault();
          addChip(tag);
          searchInputVisual.value = "";
          suggestionsBox.classList.add("hidden");
          suggestionsBox.innerHTML = "";
          searchInputVisual.focus();
        });

        const rightSide = document.createElement('div');
        rightSide.className = "flex items-center gap-2";
        
        const recentLabel = document.createElement('span');
        recentLabel.className = "text-xs text-gray-500";
        recentLabel.textContent = "Recent";

        const deleteBtn = document.createElement('button');
        deleteBtn.className = "text-gray-500 hover:text-red-400 focus:outline-none p-1 rounded-full hover:bg-gray-600 transition-colors";
        deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>`;
        deleteBtn.addEventListener('click', (e) => {
           e.stopPropagation();
           let rTags = JSON.parse(localStorage.getItem('recentSearchTags') || '[]');
           rTags = rTags.filter(t => t !== tag);
           localStorage.setItem('recentSearchTags', JSON.stringify(rTags));
           showRecentTags();
        });

        rightSide.appendChild(recentLabel);
        rightSide.appendChild(deleteBtn);
        item.appendChild(textSpan);
        item.appendChild(rightSide);
        
        suggestionsBox.appendChild(item);
      });
      suggestionsBox.classList.remove("hidden");
    } else {
      suggestionsBox.classList.add("hidden");
    }
  };

  if (searchInputVisual) {
    searchInputVisual.addEventListener("focus", () => {
       if (searchInputVisual.value.trim() === '') {
          showRecentTags();
       }
    });
    
    searchInputVisual.addEventListener("input", async (e) => {
      const val = searchInputVisual.value;
      if (val.endsWith(" ")) {
         const trimmed = val.trim();
         if (trimmed) {
            addChip(trimmed.replace(/\s+/g, '_'));
         }
         searchInputVisual.value = "";
         showRecentTags();
         return;
      }
      
      const currentTerm = val.trim();
      activeSuggestionIndex = -1;

      if (currentTerm.length < 2) {
        if (currentTerm.length === 0) showRecentTags();
        else suggestionsBox.classList.add("hidden");
        return;
      }

      try {
        const response = await fetch(`/api/tagsuggest?term=${currentTerm}`);
        const tags = await response.json();
        
        // Prevent race conditions when user types space and clears input before fetch completes
        if (searchInputVisual.value.trim() !== currentTerm) return;

        suggestionsBox.innerHTML = "";

        if (tags.length > 0) {
          tags.forEach((tag) => {
            const suggestionItem = document.createElement("button");
            suggestionItem.type = "button";
            suggestionItem.className =
              "flex justify-between w-full items-center px-4 py-2 hover:bg-gray-700 text-white rounded-md cursor-pointer gap-2 suggestion-item focus:outline-none";

            const postCount = tag.post_count.toLocaleString("en-US");
            suggestionItem.innerHTML = `<span class="truncate">${tag.name.replace(/_/g, ' ')}</span><span class="text-sm text-gray-400 whitespace-nowrap">${postCount}</span>`;

            suggestionItem.addEventListener("click", (e) => {
              e.preventDefault();
              addChip(tag.name);
              searchInputVisual.value = "";
              showRecentTags();
              searchInputVisual.focus();
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
    });

    searchInputVisual.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && searchInputVisual.value === "") {
         let tags = searchInput.value.split(' ').filter(t => t.trim());
         if (tags.length > 0) {
            tags.pop();
            searchInput.value = tags.join(' ');
            renderChips();
            showRecentTags();
         }
      }
      
      const suggestions = suggestionsBox.querySelectorAll(".suggestion-item");
      const isSuggestionsVisible = suggestions.length > 0 && !suggestionsBox.classList.contains("hidden");

      if (e.key === "ArrowDown") {
        if (!isSuggestionsVisible) return;
        e.preventDefault();
        activeSuggestionIndex = (activeSuggestionIndex + 1) % suggestions.length;
        setActiveSuggestion();
      } else if (e.key === "ArrowUp") {
        if (!isSuggestionsVisible) return;
        e.preventDefault();
        activeSuggestionIndex = (activeSuggestionIndex - 1 + suggestions.length) % suggestions.length;
        setActiveSuggestion();
      } else if (e.key === "Enter") {
        e.preventDefault(); // Prevent native form submit to avoid race conditions
        
        if (isSuggestionsVisible) {
          if (activeSuggestionIndex > -1) {
             suggestions[activeSuggestionIndex].click();
          } else if (!suggestionsBox.innerHTML.includes('Recent Searches')) {
             suggestions[0].click();
          } else {
             searchForm.requestSubmit();
          }
        } else {
          searchForm.requestSubmit();
        }
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

  document.addEventListener("mouseover", (e) => {
    if (isMobile()) return;
    const item = e.target.closest(".gallery-item");
    if (!item) return;
    const settings = JSON.parse(localStorage.getItem("cytusGalleryFilters"));
    if (settings && settings.autoplayToggle) playStopVideo(item, "play");
  });

  document.addEventListener("mouseout", (e) => {
    if (isMobile()) return;
    const item = e.target.closest(".gallery-item");
    if (!item) return;
    if (e.relatedTarget && item.contains(e.relatedTarget)) return;
    playStopVideo(item, "stop");
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

    // Tangani klik pada elemen interaktif terlebih dahulu
    const interactiveEl = e.target.closest("a, button");
    if (interactiveEl && interactiveEl.closest(".gallery-item")) {
      if (interactiveEl.classList.contains("detail-button")) {
        e.preventDefault();
        showLoader("Getting Data Content...");
        window.location.href = interactiveEl.href;
      }
      return; // Biarkan klik pada tombol 'Simpan' berjalan normal
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

    const link = e.target.closest("a");
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

  // Fast Navigation Pagination
  document.addEventListener("keydown", (e) => {
    // Ignore if user is typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    // Check if infinite scroll is active; if so, disable arrow navigation
    const filters = JSON.parse(localStorage.getItem("cytusGalleryFilters") || "{}");
    if (filters.scrollToggle) return;

    
    // Also ignore if the search bar dropdown is open, maybe? Not strictly necessary.
    if (e.key === "ArrowRight") {
      const nextBtn = document.querySelector('nav#pagination-nav a[rel="next"]');
      if (nextBtn) {
        e.preventDefault();
        showLoader("Navigating...");
        setTimeout(() => {
          window.location.href = nextBtn.href;
        }, 50);
      }
    } else if (e.key === "ArrowLeft") {
      const prevBtn = document.querySelector('nav#pagination-nav a[rel="prev"]');
      if (prevBtn) {
        e.preventDefault();
        showLoader("Navigating...");
        setTimeout(() => {
          window.location.href = prevBtn.href;
        }, 50);
      }
    }
  });

  // Infinite Scroll Logic
  const initInfiniteScroll = () => {
    const paginationNav = document.getElementById("pagination-nav");
    const mainGallery = document.getElementById("main-gallery");
    const filters = JSON.parse(localStorage.getItem("cytusGalleryFilters") || "{}");
    
    if (paginationNav && mainGallery && filters.scrollToggle) {
       const currentPage = parseInt(paginationNav.getAttribute('data-current-page'), 10);
       const totalPages = parseInt(paginationNav.getAttribute('data-total-pages'), 10);
       const baseUrl = paginationNav.getAttribute('data-base-url');
       
       if (currentPage < totalPages) {
          paginationNav.classList.add('hidden'); // hide traditional pagination
          
          const loaderDiv = document.createElement('div');
          loaderDiv.className = 'w-full flex justify-center py-8 mt-4';
          loaderDiv.innerHTML = '<div class="w-8 h-8 border-4 border-t-cyan-500 border-gray-600 rounded-full animate-spin"></div>';
          mainGallery.parentNode.insertBefore(loaderDiv, mainGallery.nextSibling);
          
          let nextPage = currentPage + 1;
          let isFetching = false;
          
          const observer = new IntersectionObserver(async (entries) => {
             if (entries[0].isIntersecting && !isFetching && nextPage <= totalPages) {
                isFetching = true;
                try {
                   const res = await fetch(baseUrl + nextPage);
                   const text = await res.text();
                   const parser = new DOMParser();
                   const doc = parser.parseFromString(text, 'text/html');
                   const newItems = doc.querySelectorAll('#main-gallery .gallery-item');
                   
                   if (mainGallery.appendMasonryItems) {
                      mainGallery.appendMasonryItems(Array.from(newItems));
                   } else {
                      newItems.forEach(item => {
                         mainGallery.appendChild(item);
                      });
                   }
                   
                   nextPage++;
                   if (nextPage > totalPages) {
                      loaderDiv.innerHTML = '<span class="text-cyan-400 font-bold">Semua konten dimuat.</span>';
                      observer.disconnect();
                   }
                } catch (e) {
                   console.error('Infinite scroll fetch error:', e);
                   loaderDiv.innerHTML = '<span class="text-red-400 font-bold">Gagal memuat konten selanjutnya.</span>';
                }
                isFetching = false;
             }
          }, { rootMargin: '400px' });
          
          observer.observe(loaderDiv);
       }
    }
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

window.savePostOverlay = async function(event, postId, btnEl) {
  event.preventDefault();
  event.stopPropagation();
  
  btnEl.disabled = true;
  const originalHtml = btnEl.innerHTML;
  btnEl.innerHTML = `<svg class="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
  
  try {
    const res = await fetch('/api/save/' + postId, { method: 'POST' });
    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }
    const data = await res.json();
    
    if (data.saved !== undefined) {
      const galleryItem = btnEl.closest('.gallery-item');
      if (data.saved) {
        btnEl.classList.remove('bg-gray-700', 'hover:bg-gray-600', 'bg-yellow-600', 'hover:bg-yellow-700');
        btnEl.classList.add('bg-green-600', 'hover:bg-green-700');
        btnEl.innerHTML = `<svg class="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path></svg>`;
        if(galleryItem) galleryItem.classList.add('border-4', 'border-yellow-500');
      } else {
        btnEl.classList.remove('bg-green-600', 'hover:bg-green-700', 'bg-yellow-600', 'hover:bg-yellow-700');
        btnEl.classList.add('bg-gray-700', 'hover:bg-gray-600');
        btnEl.innerHTML = `<svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path></svg>`;
        if(galleryItem) galleryItem.classList.remove('border-4', 'border-yellow-500');
      }
      if (typeof window.showAlert === 'function') {
        window.showAlert('Berhasil', data.message, null);
      } else {
        alert(data.message);
      }
    } else {
      throw new Error(data.error || "Gagal menyimpan konten");
    }
  } catch (err) {
    console.error(err);
    btnEl.innerHTML = originalHtml;
    if (typeof window.showAlert === 'function') {
      window.showAlert('Error', 'Terjadi kesalahan saat menyimpan konten.');
    } else {
      alert('Terjadi kesalahan saat menyimpan konten.');
    }
  } finally {
    btnEl.disabled = false;
  }
};

window.forceDownload = async function(url, filename, btnEl) {
  event.preventDefault();
  event.stopPropagation();
  
  if (btnEl) btnEl.disabled = true;
  const originalHtml = btnEl ? btnEl.innerHTML : '';
  
  if (btnEl) {
    btnEl.innerHTML = `<svg class="animate-spin h-4 w-4 text-white mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Gagal mengunduh file.");
    const blob = await response.blob();
    
    // Attempt to guess extension from content type if URL doesn't have one
    const contentType = response.headers.get('content-type');
    let ext = url.split('.').pop().split(/#|\?/)[0];
    if (ext.length > 4 || !ext) {
      if (contentType === 'image/jpeg') ext = 'jpg';
      else if (contentType === 'image/png') ext = 'png';
      else if (contentType === 'image/gif') ext = 'gif';
      else if (contentType === 'video/mp4') ext = 'mp4';
      else if (contentType === 'video/webm') ext = 'webm';
      else ext = 'jpg'; // Fallback
    }
    
    const finalFilename = `${filename}.${ext}`;
    
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = finalFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Download error:', error);
    if (typeof window.showAlert === 'function') {
      window.showAlert('Error', 'Gagal mengunduh file. Kemungkinan dihalangi oleh browser (CORS).');
    } else {
      alert('Gagal mengunduh file.');
    }
  } finally {
    if (btnEl) {
      btnEl.innerHTML = originalHtml;
      btnEl.disabled = false;
    }
  }
};

// Tambahkan animasi loading saat navigasi halaman antar menu
document.addEventListener('click', (e) => {
  const link = e.target.closest('a');
  if (link && link.href) {
    try {
      const url = new URL(link.href);
      const isInternal = url.origin === window.location.origin;
      const isAnchor = url.hash && url.pathname === window.location.pathname;
      const isSpecial = link.target === '_blank' || link.hasAttribute('download');
      
      if (isInternal && !isAnchor && !isSpecial) {
        // Jangan tampilkan loader jika ini adalah request pagination masonry atau action button
        if (!link.classList.contains('follow-btn') && !link.classList.contains('action-btn') && !link.classList.contains('tag-link')) {
          if (typeof window.showLoader === 'function') {
             window.showLoader("Memuat Halaman...");
          }
        }
      }
    } catch(err){}
  }
});

// --- CUSTOM GLOBAL TOOLTIP ---
(function() {
  const tooltipEl = document.createElement('div');
  tooltipEl.className = 'fixed bg-gray-900 border border-gray-600 text-white text-xs px-2 py-1.5 rounded shadow-xl pointer-events-none opacity-0 transition-opacity duration-200 whitespace-nowrap';
  tooltipEl.style.zIndex = '999999';
  document.body.appendChild(tooltipEl);

  let tooltipTarget = null;

  document.addEventListener('mouseover', (e) => {
    // Nonaktifkan di mobile agar tidak mengganggu interaksi sentuh
    if(window.innerWidth < 768) return; 
    let target = e.target;
    
    while (target && target !== document) {
      if (target.hasAttribute('title') && target.getAttribute('title').trim() !== '') {
        target.setAttribute('data-tooltip', target.getAttribute('title'));
        target.removeAttribute('title');
      }
      if (target.hasAttribute('data-tooltip')) {
        tooltipTarget = target;
        tooltipEl.textContent = target.getAttribute('data-tooltip');
        tooltipEl.style.opacity = '1';
        positionTooltip(e);
        break;
      }
      target = target.parentNode;
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (tooltipTarget) {
      positionTooltip(e);
    }
  });

  document.addEventListener('mouseout', (e) => {
    if (tooltipTarget && (!e.relatedTarget || !tooltipTarget.contains(e.relatedTarget))) {
      tooltipEl.style.opacity = '0';
      tooltipTarget = null;
    }
  });

  const hideTooltip = () => {
    tooltipEl.style.opacity = '0';
    tooltipTarget = null;
  };
  document.addEventListener('mousedown', hideTooltip);
  document.addEventListener('touchstart', hideTooltip, {passive: true});
  window.addEventListener('scroll', hideTooltip, {passive: true});

  function positionTooltip(e) {
    let top = e.clientY + 15;
    let left = e.clientX + 15;
    
    if (left + tooltipEl.offsetWidth > window.innerWidth - 10) {
      left = e.clientX - tooltipEl.offsetWidth - 10;
    }
    if (top + tooltipEl.offsetHeight > window.innerHeight - 10) {
      top = e.clientY - tooltipEl.offsetHeight - 10;
    }
    
    tooltipEl.style.top = top + 'px';
    tooltipEl.style.left = left + 'px';
  }
})();
