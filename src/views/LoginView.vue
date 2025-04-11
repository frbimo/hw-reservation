<template>
  <div>
    <h2>Login</h2>
    <form @submit.prevent="handleSubmit">
      <input type="text" required placeholder="Username" v-model="username">
      <div v-if="error" class="error">{{ error }}</div>
      <button type="submit" :disabled="isLoading">
        {{ isLoading ? 'Logging in...' : 'Login' }}
      </button>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { setCurrentUser } from '../services/apiSimulator';
// Simulated list of users
const validUsers = ['BIMO', 'bob', 'charlie', 'dave'];

const router = useRouter();
const route = useRoute();

const username = ref('');
const error = ref(null);
const isLoading = ref(false);

const handleSubmit = async () => {
  error.value = null;
  isLoading.value = true;
  try {
    // if (!validUsers.includes(username.value.toLowerCase())) {
    //   throw new Error('Invalid username');
    // }

    console.log('Login successful');
    localStorage.setItem('currentUser', username.value);
    setCurrentUser(username.value);
    const redirectPath = route.query.redirect || { name: 'Scheduler' };
    router.push(redirectPath);
  } catch (err) {
    console.error(err);
    error.value = err.message;
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
.error {
  color: red;
  margin-top: 10px;
}

form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 300px;
}
</style>