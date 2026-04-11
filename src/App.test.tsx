import { render, screen, waitFor } from '@testing-library/react'
import { expect, test, describe } from 'vitest'
import App from './App'

describe('Deposit Defender App', () => {
  test('renders Move-in Inspection header after loading', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText(/Move-in Inspection/i)).toBeInTheDocument()
    })
  })

  test('renders initial rooms from walkthrough.json after loading', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText(/Bedroom/i)).toBeInTheDocument()
      expect(screen.getByText(/Kitchen/i)).toBeInTheDocument()
      expect(screen.getByText(/Bathroom/i)).toBeInTheDocument()
    })
  })
})
