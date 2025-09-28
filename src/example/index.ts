import {ExpressKit, withContract, AppRoutes, RouteContract} from '@gravity-ui/expresskit';
import {NodeKit} from '@gravity-ui/nodekit';
import {z} from 'zod';

// Define your Zod schemas
const TaskSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  createdAt: z.string().datetime(),
});

const ErrorSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
});

// Configure the API endpoint
const CreateTaskConfig = {
  name: 'CreateTask',
  operationId: 'createTaskOperation',
  summary: 'Creates a new task',
  request: {
    body: z.object({
      name: z.string().min(1),
      description: z.string().optional(),
    }),
  },
  response: {
    content: {
      // Using the simplified syntax for a 201 response
      201: TaskSchema,
      // Using the object syntax when a description is needed
      400: {
        schema: ErrorSchema,
        description: 'Invalid input data.',
      },
    },
  },
} satisfies RouteContract;

// Create your route handler, wrapped with withContract
const createTaskHandler = withContract(CreateTaskConfig)(async (req, res) => {
  // req.body is automatically validated and typed
  const {name, description} = req.body;

  const newTask = {
    id: 'task_' + Date.now(),
    name,
    description,
    createdAt: new Date().toISOString(),
  };

  // Validates response against TaskSchema and sends it
  res.sendValidated(201, newTask);
});

// Example with manual validation
const manualValidationHandler = withContract(CreateTaskConfig, {
  manualValidation: true,
})(async (req, res) => {
  // Need to manually validate since manualValidation is true
  const {body} = await req.validate();
  const {name, description} = body;

  const newTask = {
    id: 'task_' + Date.now(),
    name,
    description,
    createdAt: new Date().toISOString(),
  };

  res.sendValidated(201, newTask);
});

// Integrate with your Express/ExpressKit routes
const routes: AppRoutes = {
  'POST /tasks': createTaskHandler,
};

const nodekit = new NodeKit();
const app = new ExpressKit(nodekit, routes);