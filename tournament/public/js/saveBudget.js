function saveBudget() {
  const budgetValue = document.getElementById("budgetValue").value
  if (!budgetValue || isNaN(budgetValue)) {
    alert("Enter a valid budget")
    return
  }

  fetch("/save-budget", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ budget: Number.parseFloat(budgetValue) }),
  })
    .then((response) => {
      if (!response.ok) throw new Error("Failed to save budget")
      return response.json()
    })
    .then((data) => {
      alert("Budget saved!")
      // Update the display immediately
      updateBudgetDisplay()
      // Clear the input
      document.getElementById("budgetValue").value = ""
    })
    .catch((error) => {
      console.error(error)
      alert("Error saving budget")
    })
}

// Function to update budget display after saving
function updateBudgetDisplay() {
  fetch("/get-budget")
    .then((res) => res.json())
    .then((data) => {
      const budget = data.budget || 0
      const budgetBtn = document.querySelector(".budget-amount")
      const budgetDisplay = document.getElementById("budgetDisplay")

      if (budgetBtn) {
        budgetBtn.textContent = `$${budget.toFixed(2)}`
      }
      if (budgetDisplay) {
        budgetDisplay.textContent = `$${budget.toFixed(2)}`
      }
    })
    .catch((error) => {
      console.error("Error loading budget:", error)
    })
}
