import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/business/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/business/"!</div>
}
