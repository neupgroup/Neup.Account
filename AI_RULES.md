# AI Rules and Tech Stack

## Tech Stack

- **Framework**: Next.js 15 with App Router and TypeScript
- **Database**: Firebase (Firestore for NoSQL data, Authentication for user management)
- **UI Components**: Radix UI primitives with shadcn/ui components
- **Styling**: Tailwind CSS for utility-first styling
- **Forms**: React Hook Form with Zod for validation
- **Icons**: Lucide React for consistent iconography
- **State Management**: React Context for session management
- **Authentication**: Custom implementation using Firebase Auth
- **File Uploads**: Custom server actions with Firebase Storage
- **AI Integration**: Google's Genkit for AI flows

## Library Usage Rules

### UI Components
- Use shadcn/ui components for all UI elements
- Customize with Tailwind classes, avoid inline styles
- Use Radix UI primitives directly only when creating new components
- Maintain consistent design system with existing components

### Forms & Validation
- Use React Hook Form for all forms
- Validate with Zod schemas
- Keep validation logic in separate schema files
- Use TypeScript for all form data types

### Database Operations
- Use Firebase Admin SDK on server side
- Use Firebase Client SDK only in client components
- Batch operations when possible for performance
- Always handle errors and loading states

### Authentication
- Use custom session management with cookies
- Store session data in Firestore
- Implement proper session expiration
- Use HTTPS for all auth-related requests

### State Management
- Use React Context for global state (session, user profile)
- Use local state for component-specific data
- Avoid prop drilling beyond 2 levels
- Use server components for data fetching when possible

### Styling
- Use Tailwind CSS classes only
- Follow the default Tailwind config
- Use responsive design prefixes (sm:, md:, lg:, xl:)
- Maintain consistent spacing and color palette

### TypeScript
- Use strict mode TypeScript
- Type all props and return values
- Use interfaces for object shapes
- Avoid `any` type, use `unknown` instead when necessary

### File Organization
- Keep components in `/components` directory
- Server actions in `/actions` directory
- Types in `/types` directory
- Schemas in `/schemas` directory
- Pages follow Next.js App Router structure

### Error Handling
- Use try-catch blocks for async operations
- Return consistent error objects from server actions
- Display user-friendly error messages
- Log errors for debugging

### Performance
- Use Next.js Image component for images
- Implement proper loading states
- Use React.memo for expensive components
- Optimize bundle size with dynamic imports