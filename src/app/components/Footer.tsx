export default function Footer() {
  return (
    <footer className="py-6">
      <div className="container mx-auto px-4 text-center">
        <p className="text-muted-foreground">&copy; {new Date().getFullYear()} PathGenius. All rights reserved.</p>
      </div>
    </footer>
  )
}

