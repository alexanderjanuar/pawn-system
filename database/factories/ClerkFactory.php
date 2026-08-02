<?php

namespace Database\Factories;

use App\Models\Clerk;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Clerk>
 */
class ClerkFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->unique()->firstName(),
            'active' => true,
        ];
    }

    /**
     * Indicate that the clerk is no longer active.
     */
    public function inactive(): static
    {
        return $this->state(fn (): array => ['active' => false]);
    }
}
