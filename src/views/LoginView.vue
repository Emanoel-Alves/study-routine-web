<script setup lang="ts">
import { ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { login, register } from "../auth";

const router = useRouter();
const mode = ref<"login" | "register">("login");
const email = ref("");
const password = ref("");
const inviteCode = ref("");
const errorMessage = ref("");
const submitting = ref(false);

async function submit() {
  errorMessage.value = "";
  submitting.value = true;

  try {
    if (mode.value === "register") {
      await register(email.value, password.value, inviteCode.value);
    } else {
      await login(email.value, password.value);
    }
    await router.replace({ name: "overview" });
  } catch (error) {
    errorMessage.value =
      error instanceof TypeError
        ? "Não foi possível conectar à API. Verifique se o serviço está ativo."
        : error instanceof Error
          ? error.message
          : "Não foi possível concluir a operação. Tente novamente.";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="app-shell auth-shell">
    <header class="topbar">
      <RouterLink class="brand" to="/login" aria-label="Study Routine">
        <span class="brand-mark" aria-hidden="true">
          <span class="material-symbols-rounded">school</span>
        </span>
        <span>Study Routine</span>
      </RouterLink>
      <span class="topbar-note">Sua rotina, no seu ritmo.</span>
    </header>

    <main class="auth-main">
      <section class="auth-card" aria-labelledby="auth-heading">
        <p class="eyebrow">Acesso privado</p>
        <h1 id="auth-heading">
          {{
            mode === "login" ? "Que bom ter você de volta." : "Crie sua conta."
          }}
        </h1>
        <p class="auth-intro">
          {{
            mode === "login"
              ? "Entre para continuar organizando sua rotina de estudos."
              : "O cadastro é restrito e precisa de um código de convite."
          }}
        </p>

        <form class="auth-form" @submit.prevent="submit">
          <label for="email">E-mail</label>
          <input
            id="email"
            v-model="email"
            type="email"
            name="email"
            autocomplete="email"
            maxlength="254"
            required
          />

          <label for="password">Senha</label>
          <input
            id="password"
            v-model="password"
            type="password"
            name="password"
            :autocomplete="
              mode === 'login' ? 'current-password' : 'new-password'
            "
            minlength="12"
            maxlength="128"
            required
          />
          <span class="field-help">Use pelo menos 12 caracteres.</span>

          <template v-if="mode === 'register'">
            <label for="invite-code">Código de convite</label>
            <input
              id="invite-code"
              v-model="inviteCode"
              type="password"
              name="inviteCode"
              autocomplete="off"
              minlength="24"
              maxlength="256"
              required
            />
          </template>

          <p v-if="errorMessage" class="form-error" role="alert">
            {{ errorMessage }}
          </p>

          <button class="auth-submit" type="submit" :disabled="submitting">
            {{
              submitting
                ? "Aguarde..."
                : mode === "login"
                  ? "Entrar"
                  : "Criar conta"
            }}
          </button>
        </form>

        <p class="auth-switch">
          {{ mode === "login" ? "Tem um convite?" : "Já tem uma conta?" }}
          <button
            class="text-button"
            type="button"
            :disabled="submitting"
            @click="
              mode = mode === 'login' ? 'register' : 'login';
              errorMessage = '';
            "
          >
            {{ mode === "login" ? "Criar conta" : "Fazer login" }}
          </button>
        </p>
      </section>
    </main>
  </div>
</template>
