import type { Meta, StoryObj } from '@storybook/nextjs';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './accordion';

const meta = {
  title: 'UI/Accordion',
  component: Accordion,
  tags: ['autodocs'],
  argTypes: {
    type: { control: 'inline-radio', options: ['single', 'multiple'] },
    collapsible: { control: 'boolean' },
  },
} satisfies Meta<typeof Accordion>;

export default meta;
type Story = StoryObj<typeof meta>;

const ITEMS = [
  {
    value: 'item-1',
    question: 'What is Dalgo?',
    answer:
      'Dalgo is a data intelligence platform for NGOs covering ingestion, transformation, and visualization.',
  },
  {
    value: 'item-2',
    question: 'How is data ingested?',
    answer: 'Data is ingested through Airbyte connectors into a central warehouse.',
  },
  {
    value: 'item-3',
    question: 'Can transformations be version controlled?',
    answer: 'Yes — dbt models are managed through the UI with Git integration.',
  },
];

/** Single-open accordion that can be fully collapsed. */
export const Default: Story = {
  args: { type: 'single', collapsible: true },
  render: (args) => (
    <Accordion {...args} className="w-[460px]" data-testid="accordion">
      {ITEMS.map((item) => (
        <AccordionItem key={item.value} value={item.value}>
          <AccordionTrigger>{item.question}</AccordionTrigger>
          <AccordionContent className="text-muted-foreground">{item.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  ),
};

/** Multiple items can be open at once. */
export const Multiple: Story = {
  args: { type: 'multiple' },
  render: (args) => (
    <Accordion {...args} className="w-[460px]" data-testid="accordion-multiple">
      {ITEMS.map((item) => (
        <AccordionItem key={item.value} value={item.value}>
          <AccordionTrigger>{item.question}</AccordionTrigger>
          <AccordionContent className="text-muted-foreground">{item.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  ),
};

/** The first item opens by default. */
export const WithDefaultOpen: Story = {
  args: { type: 'single', collapsible: true, defaultValue: 'item-1' },
  render: (args) => (
    <Accordion {...args} className="w-[460px]" data-testid="accordion-default-open">
      {ITEMS.map((item) => (
        <AccordionItem key={item.value} value={item.value}>
          <AccordionTrigger>{item.question}</AccordionTrigger>
          <AccordionContent className="text-muted-foreground">{item.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  ),
};
