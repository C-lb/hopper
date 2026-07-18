import { PurchaseForm } from '@/components/PurchaseForm'

export default function NewPurchasePage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-10 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Add a purchase</h1>
        <p className="mt-2 text-sm text-foreground/60">
          Log what you bought, what it cost, and where you bought it.
        </p>
      </div>

      <PurchaseForm mode="create" />
    </div>
  )
}
