import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from '../App'

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />)
    // The app renders the "Get started" heading
    expect(screen.getByText('Get started')).toBeInTheDocument()
  })
})
