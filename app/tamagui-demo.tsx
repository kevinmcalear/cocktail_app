import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { Link } from 'expo-router'
import { MotiView } from 'moti'
import { Button, Card, H2, Paragraph, Theme, XStack, YStack } from 'tamagui'

export default function TamaguiDemoScreen() {
  return (
    <Theme name="dark">
      <YStack flex={1} backgroundColor="$backgroundStrong" alignItems="center" justifyContent="center" padding="$4">
        
        {/* Intro Text */}
        <MotiView
          from={{ opacity: 0, translateY: -20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', delay: 100 }}
        >
          <YStack alignItems="center" marginBottom="$8">
            <H2 color="$color" fontWeight="800" letterSpacing={-1}>
              The New Standard
            </H2>
            <Paragraph color="$colorSubtitle" textAlign="center" maxWidth={300}>
              Premium, buttery-smooth components powered by Tamagui & Moti.
            </Paragraph>
          </YStack>
        </MotiView>

        {/* The Stunning Card */}
        <MotiView
          from={{ opacity: 0, scale: 0.9, translateY: 40 }}
          animate={{ opacity: 1, scale: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 14, mass: 0.9, delay: 300 }}
        >
          <Card 
            size="$4" 
            borderRadius="$10"
            scale={0.9}
            hoverStyle={{ scale: 0.925 }}
            pressStyle={{ scale: 0.875 }}
            width={320}
            height={400}
            backgroundColor="$color2"
            overflow="hidden"
            borderColor="$color3"
            shadowColor="$shadowColor"
            shadowRadius={30}
            shadowOffset={{ width: 0, height: 20 }}
            shadowOpacity={0.5}
          >
            {/* Background Gradient for that wow factor */}
            <LinearGradient
              colors={['rgba(255,255,255,0.1)', 'transparent']}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 150 }}
            />
            
            <Card.Header padding="$4">
              <XStack justifyContent="space-between" alignItems="center">
                <H2 color="$color" fontFamily="$body">Negroni</H2>
                <MotiView
                  from={{ rotate: '0deg' }}
                  animate={{ rotate: '360deg' }}
                  transition={{ loop: true, type: 'timing', duration: 10000 }}
                >
                  <Ionicons name="sparkles" size={24} color="#ffd700" />
                </MotiView>
              </XStack>
              <Paragraph theme="alt2" color="$colorSubtitle">Classic & Bitter</Paragraph>
            </Card.Header>

            <Card.Footer padding="$4">
              <YStack gap="$3" width="100%">
                <Button 
                  size="$4" 
                  theme="active" 
                  backgroundColor="$color8"
                  borderRadius="$8"
                >
                  View Recipe
                </Button>
                <Link href="/" asChild>
                  <Button size="$4" variant="outlined" borderRadius="$8" borderColor="$color5">
                    Go Back
                  </Button>
                </Link>
              </YStack>
            </Card.Footer>
          </Card>
        </MotiView>

      </YStack>
    </Theme>
  )
}
