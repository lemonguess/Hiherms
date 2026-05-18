<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import Live2DStage from './components/Live2DStage.vue'

function onContextMenu(e: MouseEvent): void {
  e.preventDefault()
  window.hermes?.contextMenu?.open(e.screenX, e.screenY)
}

function handleMenuAction(action: string): void {
  switch (action) {
    case 'chat':
      window.hermes?.chat?.open('chat')
      break
    case 'settings':
      window.hermes?.chat?.open('settings')
      break
    case 'interaction':
      window.hermes?.chat?.open('interaction')
      break
    case 'hide':
      window.hermes?.pet?.hide()
      break
    case 'quit':
      window.hermes?.window?.close()
      break
  }
}

const unsubCtx = window.hermes?.contextMenu?.onAction(handleMenuAction)
onBeforeUnmount(() => unsubCtx?.())
</script>

<template>
  <div class="pointer-events-none relative h-full w-full">
    <Live2DStage class="pointer-events-auto" @contextmenu="onContextMenu" />
  </div>
</template>
