const template = `
<section class="main" v-show="todos.length">
    <ul class="todo-list">
    <li v-for="todo in filteredTodos"
        class="todo"
        :key="todo.id"
        :class="{ completed: todo.completed, editing: todo === editedTodo }">
        <div class="view">
        <label @dblclick="editTodo(todo)">{{ todo.title }}</label>
        </div>
        <input class="edit" type="text"
                v-model="todo.title"
                v-todo-focus="todo === editedTodo"
                @blur="doneEdit(todo)"
                @keyup.enter="doneEdit(todo)"
                @keyup.escape="cancelEdit(todo)"
        >
    </li>
    </ul>
</section>
`