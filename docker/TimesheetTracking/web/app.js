(function () {
  "use strict";

  function setLastUpdated() {
    var el = document.getElementById("last-updated");
    if (!el) return;
    var now = new Date();
    el.textContent = "Last updated: " + now.toLocaleString();
  }

  function computeHoursTotal() {
    var rows = document.querySelectorAll("#timesheet-table tbody tr");
    var total = 0;
    rows.forEach(function (row) {
      var cell = row.querySelector('td[data-value]:nth-child(4)');
      if (cell) {
        total += parseFloat(cell.getAttribute("data-value")) || 0;
      }
    });
    var totalEl = document.getElementById("table-hours-total");
    if (totalEl) {
      totalEl.textContent = total.toFixed(1);
    }
  }

  function enableSorting() {
    var table = document.getElementById("timesheet-table");
    if (!table) return;

    var headers = table.querySelectorAll("thead th");
    var tbody = table.querySelector("tbody");

    headers.forEach(function (header, columnIndex) {
      header.addEventListener("click", function () {
        var type = header.getAttribute("data-sort") || "string";
        var currentlyAscending = header.classList.contains("sorted-asc");
        var ascending = !currentlyAscending;

        headers.forEach(function (h) {
          h.classList.remove("sorted-asc", "sorted-desc");
        });
        header.classList.add(ascending ? "sorted-asc" : "sorted-desc");

        var rows = Array.prototype.slice.call(tbody.querySelectorAll("tr"));

        rows.sort(function (rowA, rowB) {
          var cellA = rowA.children[columnIndex];
          var cellB = rowB.children[columnIndex];
          var valueA = cellA.getAttribute("data-value") || cellA.textContent.trim();
          var valueB = cellB.getAttribute("data-value") || cellB.textContent.trim();

          if (type === "number") {
            valueA = parseFloat(valueA);
            valueB = parseFloat(valueB);
          }

          if (valueA < valueB) return ascending ? -1 : 1;
          if (valueA > valueB) return ascending ? 1 : -1;
          return 0;
        });

        rows.forEach(function (row) {
          tbody.appendChild(row);
        });
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    setLastUpdated();
    computeHoursTotal();
    enableSorting();
  });
})();
