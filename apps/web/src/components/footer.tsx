import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-2 sm:grid-cols-4 gap-8">
        <div>
          <h4 className="font-semibold text-foreground mb-3">Shop</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="/products" className="hover:text-primary transition-colors">All Products</Link></li>
            <li><Link href="#" className="hover:text-primary transition-colors">Deals</Link></li>
            <li><Link href="#" className="hover:text-primary transition-colors">New Arrivals</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-foreground mb-3">Sell</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="/sell" className="hover:text-primary transition-colors">Start Selling</Link></li>
            <li><Link href="#" className="hover:text-primary transition-colors">Seller Fees</Link></li>
            <li><Link href="#" className="hover:text-primary transition-colors">Resources</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-foreground mb-3">Support</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="#" className="hover:text-primary transition-colors">Help Center</Link></li>
            <li><Link href="#" className="hover:text-primary transition-colors">Returns</Link></li>
            <li><Link href="#" className="hover:text-primary transition-colors">Shipping</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-foreground mb-3">Empire</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="#" className="hover:text-primary transition-colors">About</Link></li>
            <li><Link href="#" className="hover:text-primary transition-colors">Blog</Link></li>
            <li><Link href="#" className="hover:text-primary transition-colors">Privacy</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Marketplace Empire. All rights reserved.
      </div>
    </footer>
  );
}