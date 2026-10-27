import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  ProgressBar,
} from '../components/ui'

describe('FitPulse Shared UI Primitives', () => {
  describe('Button', () => {
    it('renders primary button with accessible text and handles clicks', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick}>Save Workout</Button>)

      const btn = screen.getByRole('button', { name: /Save Workout/i })
      expect(btn).toBeInTheDocument()
      fireEvent.click(btn)
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('handles disabled state correctly without triggering click handler', () => {
      const handleClick = vi.fn()
      render(
        <Button disabled onClick={handleClick}>
          Disabled Action
        </Button>
      )

      const btn = screen.getByRole('button', { name: /Disabled Action/i })
      expect(btn).toBeDisabled()
      fireEvent.click(btn)
      expect(handleClick).not.toHaveBeenCalled()
    })

    it('renders loading spinner and disables interaction', () => {
      const handleClick = vi.fn()
      render(
        <Button loading onClick={handleClick}>
          Saving Progress
        </Button>
      )

      const btn = screen.getByRole('button', { name: /Saving Progress/i })
      expect(btn).toBeDisabled()
      expect(btn.querySelector('svg.animate-spin')).toBeInTheDocument()
      fireEvent.click(btn)
      expect(handleClick).not.toHaveBeenCalled()
    })

    it('supports button variants and icon rendering', () => {
      const { rerender } = render(
        <Button variant="cta" icon={<span data-testid="test-icon">⚡</span>}>
          Start Workout
        </Button>
      )

      expect(screen.getByRole('button', { name: /Start Workout/i })).toBeInTheDocument()
      expect(screen.getByTestId('test-icon')).toBeInTheDocument()

      rerender(<Button variant="destructive">Delete Item</Button>)
      expect(screen.getByRole('button', { name: /Delete Item/i })).toBeInTheDocument()
    })
  })

  describe('Card', () => {
    it('renders card with header, title, description, content, and footer', () => {
      render(
        <Card variant="raised">
          <CardHeader>
            <CardTitle>Daily Nutrition Summary</CardTitle>
            <CardDescription>Track calories and macronutrients</CardDescription>
          </CardHeader>
          <CardContent>
            <p>2,150 / 2,400 kcal</p>
          </CardContent>
          <CardFooter>
            <button type="button">View History</button>
          </CardFooter>
        </Card>
      )

      expect(screen.getByText('Daily Nutrition Summary')).toBeInTheDocument()
      expect(screen.getByText('Track calories and macronutrients')).toBeInTheDocument()
      expect(screen.getByText('2,150 / 2,400 kcal')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /View History/i })).toBeInTheDocument()
    })

    it('renders interactive card variant with hover classes', () => {
      const { container } = render(
        <Card interactive variant="default">
          Interactive Card Content
        </Card>
      )
      expect(container.firstChild).toHaveClass('hover:shadow-xs')
    })
  })

  describe('Input', () => {
    it('renders input with label and helper text, linking with accessibility IDs', () => {
      render(
        <Input
          label="Body Weight (kg)"
          helperText="Recorded before breakfast"
          placeholder="70.5"
        />
      )

      const input = screen.getByLabelText(/Body Weight \(kg\)/i)
      expect(input).toBeInTheDocument()
      expect(screen.getByText('Recorded before breakfast')).toBeInTheDocument()
      expect(input).toHaveAttribute('placeholder', '70.5')
      expect(input).not.toHaveAttribute('aria-invalid', 'true')
    })

    it('renders error message with alert role and aria-invalid', () => {
      render(
        <Input
          label="Repetitions"
          error="Reps cannot be negative"
          defaultValue="-1"
        />
      )

      const input = screen.getByLabelText(/Repetitions/i)
      expect(input).toHaveAttribute('aria-invalid', 'true')
      const errorMsg = screen.getByRole('alert')
      expect(errorMsg).toHaveTextContent('Reps cannot be negative')
    })

    it('handles disabled input correctly', () => {
      render(<Input label="Locked Field" disabled />)
      expect(screen.getByLabelText(/Locked Field/i)).toBeDisabled()
    })
  })

  describe('Badge', () => {
    it('renders badge with text and different variants', () => {
      const { rerender } = render(<Badge variant="highlight">Recommended</Badge>)
      expect(screen.getByText('Recommended')).toBeInTheDocument()

      rerender(<Badge variant="coral">140g Protein</Badge>)
      expect(screen.getByText('140g Protein')).toBeInTheDocument()

      rerender(<Badge variant="alert">Over Budget</Badge>)
      expect(screen.getByText('Over Budget')).toBeInTheDocument()
    })
  })

  describe('ProgressBar', () => {
    it('renders semantic progressbar with accessible ARIA attributes and value display', () => {
      render(
        <ProgressBar
          label="Daily Calorie Goal"
          value={1800}
          max={2400}
          showValue
          color="calories"
        />
      )

      const pb = screen.getByRole('progressbar', { name: /Daily Calorie Goal/i })
      expect(pb).toBeInTheDocument()
      expect(pb).toHaveAttribute('aria-valuenow', '1800')
      expect(pb).toHaveAttribute('aria-valuemin', '0')
      expect(pb).toHaveAttribute('aria-valuemax', '2400')
      expect(screen.getByText('1800 / 2400')).toBeInTheDocument()
    })

    it('clamps progress bar visual percentage between 0% and 100%', () => {
      const { container } = render(
        <ProgressBar value={3000} max={2500} label="Overfilled" />
      )
      const bar = container.querySelector('[role="progressbar"] > div')
      expect(bar).toHaveStyle('width: 100%')
    })
  })
})

