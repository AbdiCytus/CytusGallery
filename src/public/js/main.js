// src/public/js/main.js (SUDAH DIPERBARUI)
document.addEventListener("DOMContentLoaded", () => {
  const searchForm = document.getElementById("search-form");
  const searchInput = document.getElementById("search-input");
  const suggestionsBox = document.getElementById("suggestions-box");
  let activeSuggestionIndex = -1;

  const setActiveSuggestion = () => {
    const suggestions = suggestionsBox.querySelectorAll("a");
    suggestions.forEach((item, index) => {
      if (index === activeSuggestionIndex) {
        item.classList.add("bg-gray-700");
      } else {
        item.classList.remove("bg-gray-700");
      }
    });
  };

  searchInput.addEventListener("input", async () => {
    const term = searchInput.value;
    activeSuggestionIndex = -1; // Reset saat input berubah

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
          suggestionItem.innerHTML = `
                        <span>${tag.name}</span>
                        <span class="text-sm text-gray-400 float-right">${postCount}</span>
                    `;
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
    if (suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeSuggestionIndex = (activeSuggestionIndex + 1) % suggestions.length;
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

  document.addEventListener("click", (e) => {
    if (!searchForm.contains(e.target)) {
      suggestionsBox.classList.add("hidden");
    }
  });
});
