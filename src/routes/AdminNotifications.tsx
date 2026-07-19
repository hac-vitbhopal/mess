import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/AdminNotifications')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/AdminNotifications"!</div>
}
export default function AdminNotifications() {
  return (
    <div className="min-h-screen p-8 bg-gray-100">
      <div className="max-w-xl mx-auto bg-white rounded-xl shadow p-6">

        <h1 className="text-2xl font-bold mb-6">
          Send Notification
        </h1>

        <input
          type="text"
          placeholder="Notification Title"
          className="w-full border rounded p-3 mb-4"
        />

        <textarea
          placeholder="Notification Message"
          className="w-full border rounded p-3 mb-4 h-32"
        />

        <button
          className="bg-blue-600 text-white px-6 py-3 rounded-lg"
        >
          Send Notification
        </button>

      </div>
    </div>
  );
}