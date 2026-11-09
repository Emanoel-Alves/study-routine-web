<template>
  <main class="app-shell not-found">
    <p class="eyebrow">Página não encontrada</p>
    <h1>Este caminho ainda não existe.</h1>
    <RouterLink class="home-link" to="/">Voltar à visão geral</RouterLink>
  </main>
</template>

<script setup lang="ts">
import { RouterLink } from "vue-router";
</script>
