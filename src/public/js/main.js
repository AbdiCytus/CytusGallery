document.addEventListener("DOMContentLoaded", () => {
  // Register Service Worker for Client-Side Caching (Opsi 4)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.error('Service Worker registration failed: ', err);
      });
    });
  }

  const currentUrl = new URL(window.location.href);
  const path = currentUrl.pathname;
  
  const urlTab = currentUrl.searchParams.get("tab");
  const tempTab = currentUrl.searchParams.get("tempTab") === "true";
  
  if (urlTab) {
    if (!tempTab) {
      localStorage.setItem("cytusGalleryActiveTab", urlTab);
      document.cookie = "cytusGalleryActiveTab=" + urlTab + "; path=/; max-age=31536000";
    }
    if (urlTab === "followed") {
      const followedTagsFilter = JSON.parse(localStorage.getItem('cytusGalleryFollowedTagsFilter') || '[]');
      const urlFollowedTags = currentUrl.searchParams.get("followedTags");
      const localFollowedTagsStr = followedTagsFilter.join(',');
      
      if (followedTagsFilter.length > 0 && urlFollowedTags !== localFollowedTagsStr) {
         currentUrl.searchParams.set("followedTags", localFollowedTagsStr);
         window.history.replaceState({}, '', currentUrl.toString());
      } else if (followedTagsFilter.length === 0 && urlFollowedTags) {
         currentUrl.searchParams.delete("followedTags");
         window.history.replaceState({}, '', currentUrl.toString());
      }
    }
  } else if (path === "/" || path === "/search") {
    const savedTab = localStorage.getItem("cytusGalleryActiveTab");
    if (savedTab && savedTab !== "contents") {
      currentUrl.searchParams.set("tab", savedTab);
      document.cookie = "cytusGalleryActiveTab=" + savedTab + "; path=/; max-age=31536000";
      if (savedTab === "followed") {
         const followedTagsFilter = JSON.parse(localStorage.getItem('cytusGalleryFollowedTagsFilter') || '[]');
         if (followedTagsFilter.length > 0) {
            currentUrl.searchParams.set("followedTags", followedTagsFilter.join(","));
         }
      }
      window.history.replaceState({}, '', currentUrl.toString());
    }
  }
  
  // URL parameters are kept to ensure the back button works correctly after searching

  const loadingOverlay = document.getElementById("loading-overlay");
  const loadingText = document.getElementById("loading-text");
  const searchInputOnLoad = document.getElementById("search-input");
  const savedTags = sessionStorage.getItem("lastSearchTags");
  const navigationEntries = performance.getEntriesByType("navigation");

  const showLoader = (message = "Memuat Konten...") => {
    if (loadingOverlay && loadingText) {
      loadingText.textContent = message;
      loadingOverlay.classList.remove("opacity-0", "pointer-events-none");
    }
  };
  window.showLoader = showLoader;

  const hideLoader = () => {
    if (loadingOverlay) {
      setTimeout(() => {
        loadingOverlay.classList.add("opacity-0", "pointer-events-none");
      }, 100);
    }
  };

  if (sessionStorage.getItem("isLoadingMessage")) {
    showLoader(sessionStorage.getItem("isLoadingMessage"));
    sessionStorage.removeItem("isLoadingMessage");
    sessionStorage.removeItem("isLoading");
  } else if (sessionStorage.getItem("isLoading") === "true") {
    showLoader("Memuat Konten...");
    sessionStorage.removeItem("isLoading");
  }

  if (savedTags && searchInputOnLoad) searchInputOnLoad.value = savedTags;

  // back_forward navigation loader removed

  // Old pageshow listener removed

  // Event beforeunload dihapus untuk mencegah loader tersangkut saat navigasi kembali

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

  const tagColorCache = window.tagColorCache || {};
  window.tagColorCache = tagColorCache;

  const updateBackgroundGradient = (category) => {
    if (window.location.pathname !== '/' && window.location.pathname !== '/search') return;
    
    const body = document.body;
    const gradClasses = ['bg-gradient-to-r', 'from-gray-900', 'to-purple-900/40', 'to-green-900/40', 'to-red-900/40', 'to-blue-900/40', 'to-orange-900/40', 'to-black/80', 'bg-fixed'];
    body.classList.remove(...gradClasses);
    
    // Check if rating filter is turned off
    let isRatingActive = true;
    const toggleEl = document.getElementById("rating-toggle");
    if (toggleEl) {
       isRatingActive = toggleEl.checked;
    } else {
       const filters = JSON.parse(localStorage.getItem("cytusGalleryFilters") || "{}");
       if (filters.ratingToggle === false) isRatingActive = false;
    }

    if (!isRatingActive) {
       body.classList.add('bg-gradient-to-r', 'from-gray-900', 'to-black/80', 'bg-fixed');
       return;
    }

    const gradColors = {
      3: 'to-purple-900/40',
      4: 'to-green-900/40',
      1: 'to-red-900/40',
      0: 'to-blue-900/40',
      5: 'to-orange-900/40'
    };
    
    const gradColor = gradColors[category];
    if (gradColor) {
      body.classList.add('bg-gradient-to-r', 'from-gray-900', gradColor, 'bg-fixed');
    }
  };
  window.updateBackgroundGradient = updateBackgroundGradient;

  const renderChips = async () => {
    if (!searchChipsContainer || !searchInput) return;
    
    const tags = searchInput.value.split(' ').filter(t => t.trim());
    searchChipsContainer.innerHTML = '';
    
    const chipElements = [];
    tags.forEach(tag => {
      const chip = document.createElement('div');
      chip.className = 'flex items-center bg-cyan-600 text-white px-2 py-1 rounded-full text-sm font-semibold shadow-sm transition-colors duration-300';
      chip.innerHTML = `<span>${tag.replace(/_/g, ' ')}</span><button type="button" class="ml-1 text-cyan-200 hover:text-white transition-colors" onclick="removeChip('${tag}')">&times;</button>`;
      searchChipsContainer.appendChild(chip);
      chipElements.push({ tag, element: chip });
    });
    
    if (tags.length === 0) {
       updateBackgroundGradient(-1);
       return;
    }

    let lastCategory = 0;
    await Promise.all(chipElements.map(async (item, index) => {
      const { tag, element } = item;
      let category = tagColorCache[tag];
      
      if (category === undefined) {
        try {
          const res = await fetch(`https://danbooru.donmai.us/tags.json?search[name]=` + encodeURIComponent(tag));
          if (res.ok) {
            const data = await res.json();
            if (data && data.length > 0) {
              category = data[0].category;
              tagColorCache[tag] = category;
            } else {
              category = 0;
              tagColorCache[tag] = 0;
            }
          } else {
            category = 0;
          }
        } catch (e) {
          category = 0;
        }
      }
      
      const themeColors = {
        3: { bg: 'bg-purple-600', text: 'text-purple-200' },
        4: { bg: 'bg-green-600', text: 'text-green-200' },
        1: { bg: 'bg-red-600', text: 'text-red-200' },
        0: { bg: 'bg-blue-600', text: 'text-blue-200' },
        5: { bg: 'bg-orange-600', text: 'text-orange-200' }
      };
      
      const theme = themeColors[category] || themeColors[0];
      
      element.classList.remove('bg-cyan-600');
      element.classList.add(theme.bg);
      
      const btn = element.querySelector('button');
      if (btn) {
        btn.classList.remove('text-cyan-200');
        btn.classList.add(theme.text);
      }
      
      if (index === chipElements.length - 1) {
         lastCategory = category;
      }
    }));
    
    updateBackgroundGradient(lastCategory);
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
      } else if (title.toLowerCase().includes('ikuti tag')) {
        iconWrapper.className = 'flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full bg-cyan-900/50';
        icon.setAttribute('class', 'w-6 h-6 text-cyan-400');
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>';
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
      } else if (title.toLowerCase().includes('unfollow')) {
        customAlertConfirm.textContent = 'Unfollow';
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

  window.showToast = function(message, type = 'success') {
    let toasterContainer = document.getElementById('toaster-container');
    if (!toasterContainer) {
      toasterContainer = document.createElement('div');
      toasterContainer.id = 'toaster-container';
      toasterContainer.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none items-center w-full px-4 sm:w-auto sm:px-0';
      document.body.appendChild(toasterContainer);
    }
    
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-600' : (type === 'error' ? 'bg-red-600' : 'bg-cyan-600');
    toast.className = `${bgColor} text-white px-4 py-2 rounded-full shadow-lg transition-all duration-300 transform -translate-y-10 opacity-0 flex items-center gap-2 pointer-events-auto border border-white/20 text-center`;
    
    const iconHtml = type === 'success' 
      ? `<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`
      : `<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
      
    toast.innerHTML = `${iconHtml}<span class="text-sm font-medium w-full">${message}</span>`;
    
    toasterContainer.appendChild(toast);
    
    // Animate in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toast.classList.remove('-translate-y-10', 'opacity-0');
      });
    });
    
    // Remove after 3 seconds
    setTimeout(() => {
      toast.classList.add('-translate-y-10', 'opacity-0');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 3000);
  };

  const scrollToBottomBtn = document.getElementById("scroll-to-bottom-btn");

  if (scrollToTopBtn) {
    window.addEventListener("scroll", () => {
      if (window.scrollY > 300) {
        scrollToTopBtn.classList.remove("opacity-0", "pointer-events-none");
      } else {
        scrollToTopBtn.classList.add("opacity-0", "pointer-events-none");
      }
      
      if (scrollToBottomBtn) {
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 300) {
           scrollToBottomBtn.classList.add("opacity-0", "pointer-events-none");
        } else {
           scrollToBottomBtn.classList.remove("opacity-0", "pointer-events-none");
        }
      }
    });

    scrollToTopBtn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      const rightPanel = document.getElementById('right-panel');
      if (rightPanel && window.getComputedStyle(rightPanel).overflowY === 'auto') {
         rightPanel.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }
  
  if (scrollToBottomBtn) {
    scrollToBottomBtn.addEventListener("click", () => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
      const rightPanel = document.getElementById('right-panel');
      if (rightPanel && window.getComputedStyle(rightPanel).overflowY === 'auto') {
         rightPanel.scrollTo({ top: rightPanel.scrollHeight, behavior: 'smooth' });
      }
    });
  }
  
  window.dispatchEvent(new Event("scroll"));

  const hideAlert = () => {
    if (!customAlert) return;
    customAlert.classList.add("hidden", "opacity-0");
    onConfirmCallback = null;

    if (sidebar && sidebar.classList.contains("translate-x-full")) {
      document.body.classList.remove("body-no-scroll");
    }
  };

  const isMobile = () => window.innerWidth < 768;

  const navigateWithFilters = async (userTypedTags = "", page = 1, tab = null, useAjax = false, isAutoSearch = false) => {
    let activeTab = tab;
    if (!activeTab) {
       activeTab = localStorage.getItem('cytusGalleryActiveTab') || 'contents'; 
       if (userTypedTags && activeTab === 'collection') { 
         activeTab = 'contents'; 
         localStorage.setItem('cytusGalleryActiveTab', 'contents'); 
         document.cookie = "cytusGalleryActiveTab=contents; path=/; max-age=31536000";
       }
    } else {
       localStorage.setItem("cytusGalleryActiveTab", activeTab);
       document.cookie = "cytusGalleryActiveTab=" + activeTab + "; path=/; max-age=31536000";
    }

    if (activeTab === 'contents') {
       sessionStorage.setItem("lastSearchTags", userTypedTags.trim());
    }

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
        const selectedRatings = filters.rating.split(',');
        let mappedRatings = [];
        
        if (selectedRatings.includes("g")) mappedRatings.push("g");
        if (selectedRatings.includes("s")) mappedRatings.push("s");
        if (selectedRatings.includes("not_e")) mappedRatings.push("g", "s"); // fallback for cached 'not_e'
        if (selectedRatings.includes("e")) {
          if (isBypassUser) {
            mappedRatings.push("e", "q");
          } else {
            // Force fallback if user logged out but still has 'e' in local storage
            if (!mappedRatings.includes("g") && !mappedRatings.includes("s")) mappedRatings.push("g", "s");
          }
        }
        
        if (mappedRatings.length > 0) {
          // Remove duplicates if any
          mappedRatings = [...new Set(mappedRatings)];
          filterQueryParts.push(`rating:${mappedRatings.join(',')}`);
          explicitLocked = false;
        }
      } else if (!filters.ratingToggle && isBypassUser) {
        // Toggle is off and user has bypass: don't lock explicit
        explicitLocked = false;
      }
      
      if (explicitLocked) {
        // Locked explicit means showing everything except 'e' and 'q', which is 'g,s'
        filterQueryParts.push("rating:g,s");
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
    if (activeTab && activeTab !== 'contents') {
      params.append("tab", activeTab);
      if (activeTab === 'followed') {
        const followedTagsFilter = JSON.parse(localStorage.getItem('cytusGalleryFollowedTagsFilter') || '[]');
        if (followedTagsFilter.length > 0) {
          params.append("followedTags", followedTagsFilter.join(","));
        }
        
        const followedDateFilter = JSON.parse(localStorage.getItem('cytusGalleryFollowedDateFilter') || 'null');
        if (followedDateFilter && followedDateFilter.enabled) {
          let dateFilter = "";
          const d = followedDateFilter;
          if (d.mode === 'spesifik' && d.specYear) {
             let specMonth = d.specMonth;
             let specDay = d.specDay;
             let specYear = d.specYear;
             if (specMonth && specDay) {
                let m = specMonth.padStart(2, '0');
                let day = specDay.padStart(2, '0');
                dateFilter = `date:${specYear}-${m}-${day}`;
             } else if (specMonth) {
                let m = specMonth.padStart(2, '0');
                let lastDay = new Date(specYear, parseInt(m), 0).getDate();
                dateFilter = `date:${specYear}-${m}-01..${specYear}-${m}-${lastDay}`;
             } else {
                dateFilter = `date:${specYear}-01-01..${specYear}-12-31`;
             }
          } else if (d.mode === 'rentang' && d.rsYear && d.reYear) {
             let rangeStartStr = "";
             if (d.rsMonth && d.rsDay) {
                rangeStartStr = `${d.rsYear}-${d.rsMonth.padStart(2, '0')}-${d.rsDay.padStart(2, '0')}`;
             } else if (d.rsMonth) {
                rangeStartStr = `${d.rsYear}-${d.rsMonth.padStart(2, '0')}-01`;
             } else {
                rangeStartStr = `${d.rsYear}-01-01`;
             }

             let rangeEndStr = "";
             if (d.reMonth && d.reDay) {
                rangeEndStr = `${d.reYear}-${d.reMonth.padStart(2, '0')}-${d.reDay.padStart(2, '0')}`;
             } else if (d.reMonth) {
                let lastDay = new Date(d.reYear, parseInt(d.reMonth), 0).getDate();
                rangeEndStr = `${d.reYear}-${d.reMonth.padStart(2, '0')}-${lastDay}`;
             } else {
                rangeEndStr = `${d.reYear}-12-31`;
             }
             dateFilter = `date:${rangeStartStr}..${rangeEndStr}`;
          }
          
          if (dateFilter) {
             let currentQuery = params.get("query") || "";
             currentQuery = currentQuery.replace(/date:[^\s]+/g, '').trim();
             currentQuery = (currentQuery + " " + dateFilter).trim();
             params.set("query", currentQuery);
          }
        }
      } else if (activeTab === 'collection') {
        const collectionTagsFilter = JSON.parse(localStorage.getItem('cytusGalleryCollectionTagsFilter') || '[]');
        if (collectionTagsFilter.length > 0) {
          params.append("followedTags", collectionTagsFilter.join(","));
        }
        
        const collectionDateFilter = JSON.parse(localStorage.getItem('cytusGalleryCollectionDateFilter') || 'null');
        if (collectionDateFilter && collectionDateFilter.enabled) {
          let dateFilter = "";
          const d = collectionDateFilter;
          if (d.mode === 'spesifik' && d.specYear) {
             let specMonth = d.specMonth;
             let specDay = d.specDay;
             let specYear = d.specYear;
             if (specMonth && specDay) {
                let m = specMonth.padStart(2, '0');
                let day = specDay.padStart(2, '0');
                dateFilter = `date:${specYear}-${m}-${day}`;
             } else if (specMonth) {
                let m = specMonth.padStart(2, '0');
                let lastDay = new Date(specYear, parseInt(m), 0).getDate();
                dateFilter = `date:${specYear}-${m}-01..${specYear}-${m}-${lastDay}`;
             } else {
                dateFilter = `date:${specYear}-01-01..${specYear}-12-31`;
             }
          } else if (d.mode === 'rentang' && d.rsYear && d.reYear) {
             let rangeStartStr = "";
             if (d.rsMonth && d.rsDay) {
                rangeStartStr = `${d.rsYear}-${d.rsMonth.padStart(2, '0')}-${d.rsDay.padStart(2, '0')}`;
             } else if (d.rsMonth) {
                rangeStartStr = `${d.rsYear}-${d.rsMonth.padStart(2, '0')}-01`;
             } else {
                rangeStartStr = `${d.rsYear}-01-01`;
             }

             let rangeEndStr = "";
             if (d.reMonth && d.reDay) {
                rangeEndStr = `${d.reYear}-${d.reMonth.padStart(2, '0')}-${d.reDay.padStart(2, '0')}`;
             } else if (d.reMonth) {
                let lastDay = new Date(d.reYear, parseInt(d.reMonth), 0).getDate();
                rangeEndStr = `${d.reYear}-${d.reMonth.padStart(2, '0')}-${lastDay}`;
             } else {
                rangeEndStr = `${d.reYear}-12-31`;
             }
             dateFilter = `date:${rangeStartStr}..${rangeEndStr}`;
          }
          
          if (dateFilter) {
             let currentQuery = params.get("query") || "";
             currentQuery = currentQuery.replace(/date:[^\s]+/g, '').trim();
             currentQuery = (currentQuery + " " + dateFilter).trim();
             params.set("query", currentQuery);
          }
        }
      }
    }
    
    const queryString = params.toString();
    const targetUrl = queryString ? `/search?${queryString}` : "/";
    
    if (useAjax) {
      try {
        const currentMain = document.querySelector('main');
        let progressContainer = document.getElementById('tab-progress-container');
        let progressBar = document.getElementById('tab-progress-bar');
        
        // Dynamically create the progress bar if it doesn't exist
        if (!progressContainer) {
            const tabLink = document.querySelector('.main-tab-link');
            const tabsDiv = tabLink ? tabLink.closest('.flex') : null;
            if (tabsDiv) {
                progressContainer = document.createElement('div');
                progressContainer.id = 'tab-progress-container';
                progressContainer.style.cssText = 'position: absolute; bottom: -1px; left: 0; width: 100%; height: 3px; background-color: transparent; z-index: 20; pointer-events: none; opacity: 0; transition: opacity 0.2s ease;';
                
                progressBar = document.createElement('div');
                progressBar.id = 'tab-progress-bar';
                progressBar.style.cssText = 'height: 100%; background-color: #22d3ee; width: 0%; box-shadow: 0 0 12px rgba(34,211,238,1); border-radius: 9999px; transition: width 0.3s ease-out;';
                
                progressContainer.appendChild(progressBar);
                tabsDiv.appendChild(progressContainer);
            }
        }
        
        if (isAutoSearch) {
          const mainGallery = document.getElementById('main-gallery');
          if (mainGallery) {
             let skeletonHtml = '';
             for(let i=0; i<15; i++) {
                const h = 150 + Math.random() * 150;
                skeletonHtml += `<div class="relative overflow-hidden rounded-lg animate-pulse bg-gray-800" style="height: ${h}px"></div>`;
             }
             mainGallery.innerHTML = `<div class="col-span-full w-full columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4 space-y-4">${skeletonHtml}</div>`;
          }
        } else if (progressContainer && progressBar) {
           progressContainer.style.opacity = '1';
           
           setTimeout(() => {
             if (progressBar) progressBar.style.width = '40%';
           }, 10);
           
           setTimeout(() => { 
             if (progressBar) progressBar.style.width = '70%'; 
           }, 200);
        } else if (currentMain) {
           currentMain.style.transition = 'opacity 0.2s ease-in-out';
           currentMain.style.opacity = '0.5';
        }

        if (typeof closeSidebar === 'function') closeSidebar();
        
        const cacheKey = `cytus_page_${targetUrl}`;
        let text = localStorage.getItem(cacheKey);
        
        const saveToLocalCache = (key, val) => {
          try {
            localStorage.setItem(key, val);
            // Limit cache to 15 pages to prevent quota issues
            const keys = Object.keys(localStorage).filter(k => k.startsWith('cytus_page_'));
            if (keys.length > 15) {
               // Remove random/oldest keys if it exceeds 15
               localStorage.removeItem(keys[0]);
            }
          } catch(e) {}
        };
        
        if (!text) {
          const res = await fetch(targetUrl);
          text = await res.text();
          saveToLocalCache(cacheKey, text);
        } else {
          fetch(targetUrl).then(r => r.text()).then(t => {
            saveToLocalCache(cacheKey, t);
          }).catch(() => {});
        }
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        
        const newMain = doc.querySelector('main');
        
        if (newMain && currentMain) {
          if (progressBar) progressBar.style.width = '100%';
          
          const finalizeTransition = () => {
             const activeProgressContainer = document.getElementById('tab-progress-container');
             // detach it so it survives innerHTML replacement
             if (activeProgressContainer && activeProgressContainer.parentNode) {
                 activeProgressContainer.parentNode.removeChild(activeProgressContainer);
             }
             
             currentMain.innerHTML = newMain.innerHTML;
             
             // Also update pagination-nav if it exists
             const oldPagination = document.getElementById('pagination-nav');
             const newPagination = doc.getElementById('pagination-nav');
             if (oldPagination && newPagination) {
                 oldPagination.outerHTML = newPagination.outerHTML;
             }
             
             window.history.pushState({}, "", targetUrl);
             currentMain.style.opacity = '1';
             
             // Restore the old active progress bar into the new DOM
             if (activeProgressContainer) {
                 const newTabLink = document.querySelector('.main-tab-link');
                 const newTabsDiv = newTabLink ? newTabLink.closest('.flex') : null;
                 if (newTabsDiv) {
                     newTabsDiv.appendChild(activeProgressContainer);
                     
                     // fade out smoothly
                     activeProgressContainer.style.transition = 'opacity 0.3s ease';
                     setTimeout(() => activeProgressContainer.style.opacity = '0', 200);
                     setTimeout(() => {
                         const bar = document.getElementById('tab-progress-bar');
                         if (bar) {
                            bar.style.transition = 'none';
                            bar.style.width = '0%';
                            setTimeout(() => bar.style.transition = 'width 0.3s ease-out', 50);
                         }
                     }, 500);
                 }
             }
             
             if (typeof updateFollowedTabVisuals === 'function') {
                 updateFollowedTabVisuals();
             }
             
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
             
             if (typeof initializeMasonry === 'function') window.initializeMasonry = initializeMasonry; initializeMasonry();
             if (typeof initInfiniteScroll === 'function') initInfiniteScroll();
             
             setTimeout(hideLoader, 300);
          };
          
          if (progressBar) {
             setTimeout(finalizeTransition, 200);
          } else {
             finalizeTransition();
          }
        } else {
          if (typeof window.showLoader === 'function') window.showLoader("Memuat Konten...");
          window.location.href = targetUrl;
        }
      } catch (err) {
        if (typeof window.showLoader === 'function') window.showLoader("Memuat Konten...");
        window.location.href = targetUrl;
      }
    } else {
      if (typeof window.showLoader === 'function') window.showLoader("Memuat Konten...");
      window.location.href = targetUrl;
    }
  };
  window.navigateWithFilters = navigateWithFilters;

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
    
    // Intercept main tab link clicks
    if (a && a.classList.contains('main-tab-link')) {
      e.preventDefault();
      const tab = a.getAttribute('data-tab');
      
      const currentUrl = new URL(window.location.href);
      const currentTab = currentUrl.searchParams.get("tab") || "contents";
      if (tab === currentTab) {
        if (tab === 'followed' && typeof window.openFollowedTagsModal === 'function') {
          window.openFollowedTagsModal();
        }
        if (tab === 'collection' && typeof window.openCollectionFilterModal === 'function') {
          window.openCollectionFilterModal();
        }
        return; // Do not reload if already active
      }
      
      // Tab clicks are only on the main page, so userTypedTags is empty.
      // Filter settings will be auto-applied by navigateWithFilters.
      navigateWithFilters("", 1, tab, true);
    }
  });

  const saveFilters = () => {
    if (!filterForm) return;
    const formData = new FormData(filterForm);
    const filters = {
      ratingToggle: document.getElementById("rating-toggle").checked,
      rating: formData.getAll("rating").join(","),
      typeToggle: document.getElementById("type-toggle").checked,
      type: formData.get("type"),
      limit: document.getElementById("limit-input").value,
      autoplayToggle: document.getElementById("autoplay-toggle").checked,
      lazyloadToggle: document.getElementById("lazyload-toggle").checked,
      scrollToggle: document.getElementById("scroll-toggle") ? document.getElementById("scroll-toggle").checked : false,
      themeToggle: document.getElementById("theme-toggle") ? document.getElementById("theme-toggle").checked : false,
    };
    localStorage.setItem("cytusGalleryFilters", JSON.stringify(filters));
    
    // Save to cookie so server can read it for SSR (like related posts)
    let ratingCookieVal = "";
    if (filters.ratingToggle && filters.rating) {
      ratingCookieVal = filters.rating;
    }
    document.cookie = "cytusGalleryRatingFilter=" + encodeURIComponent(ratingCookieVal) + "; path=/; max-age=31536000";
  };

  const syncCookieFilter = () => {
    let filters = JSON.parse(localStorage.getItem("cytusGalleryFilters"));
    if (filters) {
      let ratingCookieVal = "";
      if (filters.ratingToggle && filters.rating) {
        ratingCookieVal = filters.rating;
      }
      document.cookie = "cytusGalleryRatingFilter=" + encodeURIComponent(ratingCookieVal) + "; path=/; max-age=31536000";
    }
  };
  syncCookieFilter(); // Run on every page load to ensure cookie matches localStorage

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
      document.cookie = "cytusGalleryRatingFilter=g; path=/; max-age=31536000";
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
    
    // Sync cookie
    let ratingCookieVal = "";
    if (ratingToggle && rating) {
      ratingCookieVal = rating;
    }
    document.cookie = "cytusGalleryRatingFilter=" + encodeURIComponent(ratingCookieVal) + "; path=/; max-age=31536000";

    const ratingToggleEl = document.getElementById("rating-toggle");
    if (ratingToggleEl) {
      ratingToggleEl.checked = ratingToggle;
      document
        .getElementById("rating-options")
        .classList.toggle("hidden", !ratingToggle);
      if (rating) {
        const selectedRatings = rating.split(',');
        let hasE = selectedRatings.includes("e");
        let validRatings = selectedRatings;

        if (hasE && document.getElementById("rating-e") === null) {
          validRatings = ["g"];
          filters.rating = "g";
          localStorage.setItem("cytusGalleryFilters", JSON.stringify(filters));
          wasMissing = true;
        }

        // Hapus tanda centang di semua input rating terlebih dahulu
        document.querySelectorAll('input[name="rating"]').forEach(el => el.checked = false);

        validRatings.forEach(actualRating => {
          const ratingInput = document.querySelector(`input[name="rating"][value="${actualRating}"]`);
          if (ratingInput) ratingInput.checked = true;
        });
      }
    }
    const typeToggleEl = document.getElementById("type-toggle");
    if (typeToggleEl) {
      typeToggleEl.checked = typeToggle;
      document
        .getElementById("type-options")
        .classList.toggle("hidden", !typeToggle);
      if (type) {
        document.querySelectorAll('input[name="type"]').forEach(el => el.checked = false);
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
    if (filters.ratingToggle !== false && filters.rating) {
      if (filters.rating.includes("e")) {
        document.body.classList.add("theme-explicit");
      } else if (filters.rating.includes("s")) {
        document.body.classList.add("theme-moderate");
      } else if (filters.rating.includes("g")) {
        document.body.classList.add("theme-safe");
      }
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

  if (sidebar) {
    sidebar.querySelectorAll('a').forEach(link => {
       link.addEventListener('click', closeSidebar);
    });
  }
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
    const galleries = document.querySelectorAll('#main-gallery, #koleksi-masonry');
    galleries.forEach(gallery => {
      if (gallery.dataset.masonryInitialized) return;
      gallery.dataset.masonryInitialized = 'true';

      gallery.className = "flex gap-4 items-start w-full";
      
      gallery._masonryItems = Array.from(gallery.querySelectorAll('.gallery-item'));
      if (gallery._masonryItems.length === 0) return;

      const getCols = () => {
        if (window.matchMedia('(min-width: 1280px)').matches) return 5;
        if (window.matchMedia('(min-width: 1024px)').matches) return 4;
        if (window.matchMedia('(min-width: 768px)').matches) return 3;
        return 2;
      };

      let cols = getCols();
      let colDivs = [];
      let colHeights = [];

      const appendItemToCol = (item) => {
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
      };

      const renderGrid = () => {
        const newCols = getCols();
        if (colDivs.length === newCols) return;
        
        cols = newCols;
        gallery.innerHTML = '';
        colDivs = [];
        
        for (let i = 0; i < cols; i++) {
          const col = document.createElement('div');
          // Fix for Safari mobile shrinking bug: forcefully set width % to prevent flex-basis collapse
          col.className = "flex flex-col gap-4 flex-1 min-w-0";
          col.style.width = `calc(${100 / cols}% - ${((cols - 1) * 16) / cols}px)`;
          gallery.appendChild(col);
          colDivs.push(col);
        }

        colHeights = new Array(cols).fill(0);
        
        gallery._masonryItems.forEach(item => {
          appendItemToCol(item);
        });
      };

      gallery.appendMasonryItems = (newItemsList) => {
         newItemsList.forEach(item => {
           gallery._masonryItems.push(item);
           if (colDivs.length > 0) {
             appendItemToCol(item);
           }
         });
      };

      renderGrid();

      const resizeObserver = new ResizeObserver(() => {
        clearTimeout(gallery.resizeTimer);
        gallery.resizeTimer = setTimeout(renderGrid, 200);
      });
      resizeObserver.observe(gallery);
    });
  };

  if (filterForm) loadFiltersToUI();
  window.initializeMasonry = initializeMasonry; initializeMasonry();

  // Sembunyikan loader HANYA setelah semua aset (gambar, dll) selesai dimuat
  window.addEventListener("load", hideLoader);

  // Ganti event listener 'pageshow' yang lama dengan yang ini:
  window.addEventListener("pageshow", () => {
    hideLoader();
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
        saveFilters(); // Langsung simpan tanpa alert
      }

      // Case 2: Mengaktifkan filter explicit
      else if (
        changedElement.name === "rating" &&
        changedElement.value === "e" &&
        changedElement.checked
      ) {
        saveFilters(); // Langsung simpan tanpa konfirmasi
      }

      // Case 3: Jika Infinite Scroll diaktifkan, reset limit ke 25
      else if (changedElement.id === "scroll-toggle" && changedElement.checked) {
        const limitInput = document.getElementById("limit-input");
        if (limitInput && limitInput.value !== "25") {
          limitInput.value = "25";
          if (window.showToast) window.showToast("Konten per halaman direset ke 25 untuk mengoptimalkan Infinite Scroll");
        }
        saveFilters();
      }

      // Case 4: Untuk semua perubahan lain yang tidak butuh konfirmasi
      else {
        saveFilters(); // Langsung simpan seperti biasa
      }
    });

    loadFiltersToUI();
    isInitializingFilters = false;

    document
      .getElementById("rating-toggle")
      ?.addEventListener("change", (e) => {
        document
          .getElementById("rating-options")
          ?.classList.toggle("hidden", !e.target.checked);
          
        if (window.updateBackgroundGradient) {
           let lastCat = -1;
           const searchInput = document.getElementById("search-input");
           if (searchInput) {
              const tags = searchInput.value.split(' ').filter(t => t.trim());
              if (tags.length > 0) {
                 const lastTag = tags[tags.length - 1];
                 if (window.tagColorCache && window.tagColorCache[lastTag] !== undefined) {
                    lastCat = window.tagColorCache[lastTag];
                 }
              }
           }
           window.updateBackgroundGradient(lastCat);
        }
      });

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
      document.activeElement?.blur();
      
      // Process any remaining text in visual input as a chip before submitting
      if (searchInputVisual && searchInputVisual.value.trim()) {
         addChip(searchInputVisual.value.trim().replace(/\s+/g, '_'));
         searchInputVisual.value = "";
      }
      
      const tags = searchInput.value.trim();
      
      const tagsArr = tags.split(/\s+/).filter(t => t);
      if (tagsArr.length > 2) {
         if (window.showToast) window.showToast("Maksimal 2 tag", "error");
         return;
      }
      
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
        const item = document.createElement('div');
        item.className = "flex justify-between items-center px-4 py-2 hover:bg-gray-700 text-gray-300 rounded-md cursor-pointer gap-2 suggestion-item";
        
        const textSpan = document.createElement('span');
        textSpan.className = "truncate flex-grow";
        textSpan.textContent = tag.replace(/_/g, ' ');
        // For click on the item directly
        item.addEventListener("click", (e) => {
          if (e.target.closest('button')) return; // Ignore if delete button clicked
          e.preventDefault();
          addChip(tag);
          searchInputVisual.value = "";
          showRecentTags();
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
      
      // Cancel previous request if any
      if (window.suggestAbortController) {
        window.suggestAbortController.abort();
      }
      window.suggestAbortController = new AbortController();
      const signal = window.suggestAbortController.signal;

      try {
        const url = new URL("https://danbooru.donmai.us/tags.json");
        url.searchParams.append("search[name_matches]", `${currentTerm}*`);
        url.searchParams.append("search[order]", "count");
        url.searchParams.append("limit", "10");
        
        const response = await fetch(url.toString(), { signal });
        const data = await response.json();
        const tags = data.filter((tag) => tag.post_count > 0);
        
        // Prevent race conditions when user types space and clears input before fetch completes
        if (searchInputVisual.value.trim() !== currentTerm) return;

        suggestionsBox.innerHTML = "";

        if (tags.length > 0) {
          tags.forEach((tag) => {
            const suggestionItem = document.createElement("button");
            suggestionItem.type = "button";
            suggestionItem.className =
              "flex justify-between w-full items-center px-4 py-2 hover:bg-gray-700 text-white rounded-md cursor-pointer gap-2 suggestion-item focus:outline-none";

            let categoryColor = 'text-white'; // 0: general
            if (tag.category === 1) categoryColor = 'text-red-400'; // artist
            else if (tag.category === 3) categoryColor = 'text-purple-400'; // copyright
            else if (tag.category === 4) categoryColor = 'text-green-400'; // character
            else if (tag.category === 5) categoryColor = 'text-yellow-400'; // meta

            const postCount = tag.post_count.toLocaleString("en-US");
            suggestionItem.innerHTML = `<span class="truncate font-medium ${categoryColor}">${tag.name.replace(/_/g, ' ')}</span><span class="text-xs text-gray-400 whitespace-nowrap">${postCount}</span>`;

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
        if (error.name !== 'AbortError') {
          console.error("Error fetching suggestions:", error);
        }
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
    // [Fix #3] Bersihkan juga elemen visual input dan chip tags agar UI benar-benar bersih
    const searchInputVisualEl = document.getElementById("search-input-visual");
    const searchChipsEl = document.getElementById("search-chips");
    if (searchInputVisualEl) searchInputVisualEl.value = "";
    if (searchChipsEl) searchChipsEl.innerHTML = "";
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
      showLoader("Memuat...");
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
    
    if (e.target.id === "filter-form") {
      const currentPath = window.location.pathname;
      const isMainPage = currentPath === '/' || currentPath.startsWith('/search');
      
      if (!isMainPage) {
        saveFilters();
        closeAllOverlays();
        closeSidebar();
        
        sessionStorage.setItem("isLoading", "true");
        sessionStorage.setItem("isLoadingMessage", "Menyimpan Pengaturan...");
        showLoader("Menyimpan Pengaturan...");
        
        setTimeout(() => {
          window.location.reload();
        }, 100);
        return;
      }
    }
    
    sessionStorage.setItem("isLoading", "true");
    
    if (e.target.id === "filter-form") {
      saveFilters();
      closeSidebar();
      sessionStorage.setItem("isLoadingMessage", "Menyimpan Pengaturan...");
      showLoader("Menyimpan Pengaturan...");
    } else {
      showLoader("Memuat...");
    }
    
    // [Fix #1] Sembunyikan keyboard mobile setelah user tekan Enter di search
    document.activeElement?.blur();
    
    navigateWithFilters(document.getElementById("search-input").value, 1);
  };

  if (filterForm) filterForm.addEventListener("submit", handleFormSubmit);

  document.addEventListener("click", (e) => {
    if (searchForm && !searchForm.contains(e.target) && suggestionsBox)
      suggestionsBox.classList.add("hidden");

    // Tangani klik pada elemen interaktif terlebih dahulu
    const interactiveEl = e.target.closest("a, button");
    if (interactiveEl) {
      const isDetailLink = interactiveEl.tagName === 'A' && interactiveEl.getAttribute('href') && interactiveEl.getAttribute('href').startsWith('/posts/');
      if (interactiveEl.classList.contains("detail-button") || isDetailLink) {
        e.preventDefault();
        
        // Jika infinite scroll aktif, buka di tab baru agar tidak merusak state
        const filters = JSON.parse(localStorage.getItem("cytusGalleryFilters") || "{}");
        if (filters.scrollToggle) {
          window.open(interactiveEl.href, '_blank');
          return;
        }

        showLoader("Memuat Konten...");
        window.location.href = interactiveEl.href;
        return;
      }
      
      if (interactiveEl.closest(".gallery-item")) {
        return; // Biarkan klik pada tombol 'Simpan' berjalan normal
      }
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
      showLoader("Memuat...");
      sessionStorage.setItem("isLoading", "true");
      const url = new URL(link.href);
      const tags = url.searchParams.get("tags") || "";
      const page = url.searchParams.get("page") || 1;
      const tab = url.searchParams.get("tab") || null;
      const userTags = tags
        .split(" ")
        .filter(
          (t) =>
            !t.startsWith("rating:") &&
            !t.startsWith("-rating:") &&
            !t.startsWith("filetype:")
        )
        .join(" ");
      navigateWithFilters(userTags, page, tab);
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
        showLoader("Memuat...");
        setTimeout(() => {
          window.location.href = nextBtn.href;
        }, 50);
      }
    } else if (e.key === "ArrowLeft") {
      const prevBtn = document.querySelector('nav#pagination-nav a[rel="prev"]');
      if (prevBtn) {
        e.preventDefault();
        showLoader("Memuat...");
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
                   if (!res.ok) throw new Error('Response tidak ok');
                   const text = await res.text();
                   
                   const parser = new DOMParser();
                   const doc = parser.parseFromString(text, 'text/html');
                   const newItems = doc.querySelectorAll('#main-gallery .gallery-item');
                   
                   if (newItems.length === 0) {
                      if (nextPage <= totalPages) {
                         throw new Error('Halaman kosong dari server (rate limit)');
                      } else {
                         loaderDiv.innerHTML = '<span class="text-cyan-400 font-bold">Semua konten dimuat.</span>';
                         observer.disconnect();
                         return;
                      }
                   }
                   
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
                   } else {
                      // Reset spinner just in case it was showing an error earlier
                      loaderDiv.className = 'w-full flex justify-center py-8 mt-4';
                      loaderDiv.innerHTML = '<div class="w-8 h-8 border-4 border-t-cyan-500 border-gray-600 rounded-full animate-spin"></div>';
                      isFetching = false;
                      observer.unobserve(loaderDiv);
                      observer.observe(loaderDiv);
                   }
                } catch (e) {
                   console.error('Infinite scroll fetch error:', e);
                   loaderDiv.innerHTML = '<span class="text-yellow-400 font-bold">Gagal memuat, scroll ke atas dan bawah sedikit untuk mencoba lagi.</span>';
                   isFetching = false;
                   // Kita sengaja TIDAK observer.disconnect() agar user bisa mencoba lagi
                   // dengan cara scroll menjauh dan mendekat ke bawah layar.
                }
             }
          }, { rootMargin: '800px' });
          
          observer.observe(loaderDiv);
       }
    }
  };
  
  // Keyboard Shortcut Ctrl+K to focus searchbar
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const searchInput = document.getElementById('search-input-visual');
      if (searchInput) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        // Jika navbar mobile tertutup, kita tidak bisa fokus elemen tersembunyi
        // tapi secara umum desktop header yang memiliki shortcut ini berguna.
        setTimeout(() => {
          searchInput.focus();
        }, window.scrollY > 300 ? 400 : 0); // Wait for scroll if needed
      }
    }
  });

  initInfiniteScroll();
});

// Debounce for Collection Search Bar in search.ejs
let koleksiSearchTimeout;
document.addEventListener('input', (e) => {
  if (e.target && e.target.id === 'koleksi-search-input') {
    const koleksiForm = document.getElementById('koleksi-search-form');
    if (!koleksiForm) return;

    clearTimeout(koleksiSearchTimeout);
    koleksiSearchTimeout = setTimeout(() => {
      if (typeof navigateWithFilters === 'function') {
        navigateWithFilters(e.target.value, 1, 'collection', true, true);
      } else {
        koleksiForm.submit();
      }
    }, 500);
  }
});

document.addEventListener('submit', (e) => {
  if (e.target && e.target.id === 'koleksi-search-form') {
    e.preventDefault();
    const input = document.getElementById('koleksi-search-input');
    if (input && typeof navigateWithFilters === 'function') {
      navigateWithFilters(input.value, 1, 'collection', true, true);
    }
  }
});

document.addEventListener("DOMContentLoaded", () => {
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

