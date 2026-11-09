import { mount, flushPromises } from "@vue/test-utils";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";
import { describe, expect, it } from "vitest";
import LoginView from "./LoginView.vue";

async function mountLoginView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/login", component: LoginView }],
  });
  await router.push("/login");
  await router.isReady();

  const wrapper = mount(RouterView, {
    global: { plugins: [router] },
  });
  await flushPromises();
  return wrapper;
}

describe("LoginView", () => {
  it("shows a sign-in form with accessible credential labels", async () => {
    const wrapper = await mountLoginView();

    expect(wrapper.get("h1").text()).toBe("Que bom ter você de volta.");
    expect(wrapper.get('input[type="email"]').attributes("required")).toBe("");
    expect(wrapper.get('input[name="password"]').attributes("minlength")).toBe(
      "12",
    );
    expect(wrapper.find("#invite-code").exists()).toBe(false);
  });

  it("only displays private registration after choosing the invite option", async () => {
    const wrapper = await mountLoginView();

    await wrapper.get(".text-button").trigger("click");

    expect(wrapper.get("h1").text()).toBe("Crie sua conta.");
    expect(wrapper.get("#invite-code").attributes("required")).toBe("");
    expect(wrapper.get("#invite-code").attributes("minlength")).toBe("24");
  });
});
