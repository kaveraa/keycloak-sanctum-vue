import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { useAuth } from '../src'
import { makeAuth, storedSession } from './helpers'

beforeEach(() => localStorage.clear())

describe('plugin Vue', () => {
  it('useAuth() dans un composant, réactif', async () => {
    storedSession('t', { name: 'Jean', roles: ['admin'] })
    const { auth } = makeAuth()

    const Profile = defineComponent({
      setup() {
        const auth = useAuth<{ name: string; roles: string[] }>()
        return () => h('p', auth.isAuthenticated.value ? `${auth.user.value?.name} (${auth.roles.value.join(', ')})` : 'invité')
      },
    })

    const wrapper = mount(Profile, { global: { plugins: [auth] } })
    expect(wrapper.text()).toBe('Jean (admin)')

    auth.clear()
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toBe('invité')

    auth.destroy()
  })

  it('$auth dans les templates', () => {
    storedSession('t', { name: 'Jean', roles: ['editor'] })
    const { auth } = makeAuth()

    const wrapper = mount({ template: '<span>{{ $auth.hasRole(\'editor\') ? \'oui\' : \'non\' }}</span>' }, { global: { plugins: [auth] } })

    expect(wrapper.text()).toBe('oui')
    auth.destroy()
  })

  it('useAuth() sans le plugin : message clair', () => {
    const Broken = defineComponent({ setup: () => (useAuth(), () => null) })

    expect(() => mount(Broken)).toThrow(/app\.use\(createKeycloakSanctum/)
  })
})
