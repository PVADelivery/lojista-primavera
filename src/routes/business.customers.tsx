import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/business/customers')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/business/customers"!</div>
}
