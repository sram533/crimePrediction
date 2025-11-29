'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export function Navbar() {
  const { theme, setTheme } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  // prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    // switch between dark and light
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  if (!mounted) {
    return (
      <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">CP</span>
                </div>
                <span className="hidden sm:inline-block text-lg font-semibold text-foreground">
                  Crime Prediction
                </span>
              </Link>
            </div>
          </div>
        </div>
      </nav>
    )
  }

  const navLinks = [
    {
      label: 'Proposal',
      href: 'https://production-gradescope-uploads.s3-us-west-2.amazonaws.com/uploads/pdf_attachment/file/222513457/CS_418_Project_Proposal-_svala.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=ASIAV45MPIOW5YCWU65N%2F20251114%2Fus-west-2%2Fs3%2Faws4_request&X-Amz-Date=20251114T100235Z&X-Amz-Expires=10800&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEJn%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCXVzLXdlc3QtMiJGMEQCIGtq%2BwYdyAlum4U2B6dn1AlcLLpgVqlnuem5q4apw6K3AiB%2BF9piVGsS6AKpoQDbpvfa%2FGP2H5f1HfdSqiuP1lSH4yq7BQhiEAAaDDQwNTY5OTI0OTA2OSIMyewiwty%2BZEUxeHOoKpgFCIPVPRHTfLg16Uf6rYriz%2BulzSUmrd5XRxHNwvUqSGSLaRjteA1Eky60dj8q0OLqxUOYS%2BablG90CGCt6QPi%2F%2FcuzSz76EY%2BCSXDy1U6NtOz%2B3Es5VGVs%2FQhFu4BFD%2BSq651E8wHBEyS7ihb9tIqwFuffpwXqulNb6uoLXOFby6jG94ZiuZqoqoZXnCe1ZSVz%2BccVzdpcJqqJ%2BwMM7XxANc5X%2BisUfueuxAHdg4vyEYrdjEHTZHUdYTJ%2FsCbLtDibM1sY2T%2FLXOhLDbspPnhVfbk9hImJgZCs5AyoQWYj7E8LbTQC4VdRfTv6TkIQMlK7Dds7pXqzMfZDbfQol0yGbz2vDtNIAsjh9env6mbg%2B3sVUcV%2BkYzXZzMYdNfJUYkdpTEl%2FyKV8W%2BFVfEK4rEWJ0FwML1oyS9moodAWj45uDf1jfuFHoy4TFrxcAKw2x1Oe%2BO%2FyCK8C2s08tLjJYQKKOVYJ3vjuz2gtryk%2BJyIBPayjr0djzMovOzjLbgKUpCC05nY%2BYNCfsjIQZFxaQbOk0w2IeI7sWZ6rcAvpr4iZoWJ4W7tAFIkI5ezKX8tNIgjAuJCAGx5Fj9ZwMtDjJDBH4EUV01fwc6ABKDsGoYA21AoNZ6Zl3WWrM10Nj6sMZYeHBTZSUOGhcrYwEs%2BuT%2FZUYrH%2F3BN2zNnm49O8v18uR0KxjcN9Hn5yPoASxAkB9l0ll4UW98GvkluA92oqIdJQAtuIPBlM2Rw3GcN3nzRiXYWcexQ70NWcdU0TNI3Pzhj5J8uiJU270OdlLj%2Fezngf2xf8xCLtxppaP%2FQlI44nEa8XyZ3W2K4jnTDIFNgHDR7UHGz1mv6SOA08gNEAOqcbt2q1l8LeT9dLKsaVJCSMQSifnAkIAahzCy5dvIBjqyAeRKh%2B6WcPtT1inHrB%2F%2Bo50j%2BtxYjNmF4eOMxYx65ez0Y7VqYA88uftyStjhvW4uqS2%2FUQwIM2i%2Fo8STj3eJ5mY94A26r%2FoPHW6WbEvEjc0izS3ANhRFcntIzhnghCzEMcUeFh91UeiuW6jTZIIYThz%2BJltH21vPJh2wSUFNkT0GXDAfsPEQUO%2FcGXwDQdffDqKQqJyoqoPji9qQaPWGiS%2FgqebEzQnF5vv38Fp6ZAidT1Y%3D&X-Amz-SignedHeaders=host&X-Amz-Signature=38d30efaf0cbc25f6c110495da0879a041c9a0ddd4a4de2ea22546676ba9e192',
      description: 'Project proposal',
      external: true
    },
    {
      label: 'Report',
      href: 'https://production-gradescope-uploads.s3-us-west-2.amazonaws.com/uploads/pdf_attachment/file/232770171/MAIN.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=ASIAV45MPIOWZEB7G4MP%2F20251114%2Fus-west-2%2Fs3%2Faws4_request&X-Amz-Date=20251114T100202Z&X-Amz-Expires=10800&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEJn%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCXVzLXdlc3QtMiJGMEQCIFoaYwC500GIMGt4HRAtjE9e6t6qe0JVtT%2Fk86PgTEZGAiA05md3I9q7j0KqQlHC0lNDadWG5NYJNWNR%2FmlITrlmIiq5BQhiEAAaDDQwNTY5OTI0OTA2OSIMB5SuXUKxGPL62vdPKpYFgiVx1NvHruLbenCxOJV0ikwciqJKCGSc4O8EjGTM5pZX9EExtMMD0%2BbejOTRCtROkB1xq01BAvu%2BZkhhmNFAf4pLyiHY%2B6brJ%2FTtE4qdq89fO3SlOTc7sJrPnbL1TBuDwr4CHn15T4e%2FXUoL74pbOy8fXyAmvAB5dtn4CYCHBAPaGesjKAU22Wn3FUgJjbh9YXA1jymrUxqDag5rg6qIkh8UHMqOZVgR5e0B8J4S8I9uj0ftUkySwLM4RhW%2BwlNgMvVjzgIGYRFeNCbAobvAGnEdhfI9cpR%2B4C7KfeRlk7QG2oAxzlm%2FFOdqvJ7Bdhancu%2F%2Fz5IXtYZskend0fp8uVBVu%2BaKbtXXcwAMpC8a26SyrXun%2Fsv21kXQ0mLJYC0g2s8NAg2ObAQjXOXvEciAJwouYJ77samScoZjJoHCf%2FdjJbbCni6WdENFADwKJ6tHyM%2FLoyDIwZxyN5SaIDgHyC0KMu7iJbNki%2BVBq787daujvAsrsIva4GEFAsS9jk3pUHMUM75Pn01uAqQBo2%2BpAick6Ju6asC8PNxN2zrYa2GSkegeudg7BEZAkH08AxDkj%2FVIugAOf6xJwlusDJR2D1QjQjs4nqev7N5%2F2aR0bAZoQ3z3fV7Dq1rlqsqDNRzjmhdXIIG74JnYthJxa%2BqFO5nXVzbd2YL41LdZcO1xBCTvu%2BkB%2BqyKEbFOnhlBaBWnHtYQdl5g16zFV23WBcGV9S3dkpvAjoHg3g%2FNHCp7LAesGiWS3WWPchobA3wbTZF6l7LzxT4MJs%2BQ6NLHukzt2tD8M%2BHveo9nUhocFLOmMamrwfNLEAyz5s8DHQRculWEW%2FAH0zmJoj5%2Bl8pFxsVckbbSeneylQlIrSCUJplivZpn70vz%2BBMwj%2BLbyAY6sgG2fYZB%2Fx92IIytVShJZyyn4Kti%2Bs97S0pUj2a08LbvXu%2F8b%2FdAz6NamZB8qzx4mGtcZh0ZIVgoaU7r%2FoizZvryTPZQLBcqrDdNaoEn5BisdPDFFL6bOxuVtv%2FGYp%2Fipxrp4IDeEi3JcOvWmnKhfgjQ5g7jKQ4B1SFFCBq0dcIIM%2FVkKpn2IO0D3eEAs1rpPIDZ65WH88h6Ei6XWzxGb%2B5yG9Xe2RYdEqT1d%2FDFGgBx9lZR&X-Amz-SignedHeaders=host&X-Amz-Signature=aad0ff6e5de6fe80afea62a74e270517cbfbfc5530f010c54770d96076ea24e2',
      description: 'Detailed project report',
      external: true
    },
    {
      label: 'Code Repository',
      href: '#',
      description: 'GitHub repository',
      external: true
    }
  ]

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">CP</span>
              </div>
              <span className="hidden sm:inline-block text-lg font-semibold text-foreground">
                Crime Prediction
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                target={link.external ? '_blank' : undefined}
                rel={link.external ? 'noopener noreferrer' : undefined}
                className="px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Dark Mode Toggle & Mobile Menu */}
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="rounded-md"
              aria-label="Toggle dark mode"
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
              aria-label="Toggle menu"
            >
              {isOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isOpen && (
        <div className="md:hidden border-t border-border bg-background">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                target={link.external ? '_blank' : undefined}
                rel={link.external ? 'noopener noreferrer' : undefined}
                className="block px-3 py-2 rounded-md text-base font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                onClick={() => setIsOpen(false)}
              >
                <div>{link.label}</div>
                <div className="text-xs text-muted-foreground">{link.description}</div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}
