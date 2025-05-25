// Updated functions to use your existing task endpoints

let tasks = []; // Array to store all tasks
let deleteMode = false;

// Function to save task to server (uses your existing endpoint)
function saveTaskToServer() {
  // This function isn't needed since we save individual tasks
}

// Function to load tasks from server
function loadTasksFromServer() {
  fetch('/get-tasks')
    .then(response => response.json())
    .then(data => {
      tasks = data.tasks || [];
      renderTasks();
    })
    .catch(error => {
      console.error('Error loading tasks:', error);
      tasks = [];
      renderTasks();
    });
}

// Function to render all tasks
function renderTasks() {
  const container = document.getElementById('itemsContainer');
  container.innerHTML = '';
  
  tasks.forEach((task, index) => {
    const taskCard = document.createElement('div');
    taskCard.className = 'item-card';
    taskCard.innerHTML = `
      <div class="item-name" id="name-${task.id}">${task.name}</div>
      <div class="item-price" id="price-${task.id}">$${parseFloat(task.price).toFixed(2)}</div>
      <button class="edit-btn" onclick="editTask('${task.id}')">Edit</button>
      <div class="delete-toggle" id="delete-${task.id}" onclick="selectForDelete('${task.id}')" style="display: ${deleteMode ? 'block' : 'none'}"></div>
    `;
    container.appendChild(taskCard);
  });
}

// Function to show the add task form
function showForm() {
  const form = document.getElementById('itemForm');
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

// Function to add a new task (uses your existing /save-task endpoint)
function addItem() {
  const nameInput = document.getElementById('itemName');
  const priceInput = document.getElementById('itemPrice');
  
  const name = nameInput.value.trim();
  const price = parseFloat(priceInput.value);
  
  if (!name || isNaN(price) || price < 0) {
    alert('Please enter a valid name and price');
    return;
  }
  
  // Use your existing /save-task endpoint
  fetch('/save-task', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name: name, price: price })
  })
  .then(response => {
    if (!response.ok) throw new Error('Failed to save task');
    return response.json();
  })
  .then(newTask => {
    // Clear form and hide it
    nameInput.value = '';
    priceInput.value = '';
    document.getElementById('itemForm').style.display = 'none';
    
    // Reload tasks from server
    loadTasksFromServer();
    
    alert('Task saved!');
  })
  .catch(error => {
    console.error('Error saving task:', error);
    alert('Error saving task');
  });
}

// Function to edit a task
function editTask(taskId) {
  const nameElement = document.getElementById(`name-${taskId}`);
  const priceElement = document.getElementById(`price-${taskId}`);
  
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  
  const currentName = task.name;
  const currentPrice = task.price;
  
  // Replace with input fields
  nameElement.innerHTML = `<input type="text" class="edit-name" value="${currentName}" id="edit-name-${taskId}">`;
  priceElement.innerHTML = `<input type="number" class="edit-price" value="${currentPrice}" id="edit-price-${taskId}">`;
  
  // Change edit button to save button
  const editBtn = nameElement.parentElement.querySelector('.edit-btn');
  editBtn.textContent = 'Save';
  editBtn.onclick = () => saveEdit(taskId);
}

// Function to save edited task (uses your existing /update-task endpoint)
function saveEdit(taskId) {
  const nameInput = document.getElementById(`edit-name-${taskId}`);
  const priceInput = document.getElementById(`edit-price-${taskId}`);
  
  const newName = nameInput.value.trim();
  const newPrice = parseFloat(priceInput.value);
  
  if (!newName || isNaN(newPrice) || newPrice < 0) {
    alert('Please enter a valid name and price');
    return;
  }
  
  // Use your existing /update-task endpoint
  fetch(`/update-task/${taskId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name: newName, price: newPrice })
  })
  .then(response => {
    if (!response.ok) throw new Error('Failed to update task');
    
    // Reload tasks from server
    loadTasksFromServer();
    
    alert('Task updated!');
  })
  .catch(error => {
    console.error('Error updating task:', error);
    alert('Error updating task');
  });
}

// Function to toggle delete mode
function toggleDeleteMode() {
  deleteMode = true;
  document.getElementById('cancelDeleteBtn').style.display = 'block';
  renderTasks();
}

// Function to cancel delete mode
function cancelDeleteMode() {
  deleteMode = false;
  document.getElementById('cancelDeleteBtn').style.display = 'none';
  renderTasks();
}

// Function to select task for deletion (uses your existing /delete-task endpoint)
function selectForDelete(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  
  if (confirm(`Delete "${task.name}"?`)) {
    fetch(`/delete-task/${taskId}`, {
      method: 'DELETE'
    })
    .then(response => {
      if (!response.ok) throw new Error('Failed to delete task');
      
      // Reload tasks from server
      loadTasksFromServer();
      
      alert('Task deleted!');
    })
    .catch(error => {
      console.error('Error deleting task:', error);
      alert('Error deleting task');
    });
  }
}

// Load tasks when page loads
document.addEventListener('DOMContentLoaded', function() {
  loadTasksFromServer();
});