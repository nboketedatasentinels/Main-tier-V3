import React from 'react'
import { Button } from '@chakra-ui/react'
import { MessageSquare, Youtube } from 'lucide-react'

export const ShamelessCirclePage: React.FC = () => {
  return (
    <div className="p-6 space-y-12">
      <header>
        <h2 className="text-3xl font-bold text-indigo-700 font-heading mb-2">Shameless Circle</h2>
        <p className="text-gray-700 font-body">Community hub for podcast enthusiasts</p>
      </header>

      <section className="bg-gray-50 rounded-lg shadow-md p-6 space-y-4">
        <h3 className="text-2xl font-semibold text-indigo-700 font-heading">Join Our Exclusive WhatsApp Community</h3>
        <p className="text-gray-800 font-body">
          Ready to amplify your insights? Join the 'Shameless Circle' WhatsApp community! This is your exclusive hub for
          podcast enthusiasts, where we dive deeper into episodes, share 'aha!' moments, and connect with fellow listeners
          worldwide. 🎧
        </p>
        <ul className="list-disc pl-5 space-y-2 text-gray-800 font-body">
          <li>Exclusive discussions about each episode</li>
          <li>Network with like-minded listeners around the globe</li>
          <li>Get instant updates, bonus content, and Q&amp;A opportunities</li>
          <li>Stay on track with suggested reading and listening schedules</li>
          <li>Discover new resources and insights from the community</li>
        </ul>
        <Button
          as="a"
          href="https://chat.whatsapp.com/GU834qw8x6JHYgrzDBUT5i?mode=ems_copy_t"
          target="_blank"
          rel="noopener noreferrer"
          colorScheme="green"
          size="lg"
          width="full"
          leftIcon={<MessageSquare size={20} />}
        >
          Join the WhatsApp Community
        </Button>
      </section>

      <section className="space-y-6">
        <h3 className="text-2xl font-semibold text-indigo-700 font-heading">
          Listen &amp; Learn: The T4L YouTube Shameless Podcast
        </h3>
        <div className="w-full aspect-video rounded-lg overflow-hidden shadow">
          <iframe
            className="w-full h-full"
            src="https://www.youtube.com/embed/Du71f-J9s2A"
            title="T4L YouTube Shameless Podcast"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            frameBorder="0"
          />
        </div>
        <Button
          as="a"
          href="https://www.youtube.com/@T4Leaders/featured"
          target="_blank"
          rel="noopener noreferrer"
          colorScheme="red"
          leftIcon={<Youtube size={20} />}
          mt={4}
        >
          View More Episodes on YouTube
        </Button>
      </section>
    </div>
  )
}
