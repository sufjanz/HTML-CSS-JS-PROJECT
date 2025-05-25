function saveBudget() {
  const budgetValue = document.getElementById('budgetValue').value;
  if (!budgetValue || isNaN(budgetValue)) {
    alert('Enter a valid budget');
    return;
  }

  fetch('/save-budget', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ budget: parseFloat(budgetValue) })
  })
  .then(response => {
    if (!response.ok) throw new Error('Failed to save budget');
    alert('Budget saved!');
  })
  .catch(error => {
    console.error(error);
    alert('Error saving budget');
  });
}
