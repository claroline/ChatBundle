<?php

/*
 * This file is part of the Claroline Connect package.
 *
 * (c) Claroline Consortium <consortium@claroline.net>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Claroline\ChatBundle\Manager;

use Claroline\ChatBundle\Entity\ChatUser;
use Claroline\CoreBundle\Entity\User;
use Claroline\CoreBundle\Pager\PagerFactory;
use Claroline\CoreBundle\Persistence\ObjectManager;
use JMS\DiExtraBundle\Annotation as DI;

/**
 * @DI\Service("claroline.manager.chat_manager")
 */
class ChatManager
{
    private $om;
    private $pagerFactory;

    private $chatUserRepo;

    /**
     * @DI\InjectParams({
     *     "om"                    = @DI\Inject("claroline.persistence.object_manager"),
     *     "pagerFactory"          = @DI\Inject("claroline.pager.pager_factory")
     * })
     */
    public function __construct(
        ObjectManager $om,
        PagerFactory $pagerFactory
    )
    {
        $this->om = $om;
        $this->pagerFactory = $pagerFactory;

        $this->chatUserRepo = $om->getRepository('ClarolineChatBundle:ChatUser');
    }

    public function createChatUser(User $user, $username, $password)
    {
        $chatUser = new ChatUser();
        $chatUser->setUser($user);
        $chatUser->setChatUsername($username);
        $chatUser->setChatPassword($password);
        $this->om->persist($chatUser);
        $this->om->flush();
    }

    public function persistChatUser(ChatUser $chatUser)
    {
        $this->om->persist($chatUser);
        $this->om->flush();
    }

    public function deleteChatUser(ChatUser $chatUser)
    {
        $this->om->remove($chatUser);
    }


    /****************************************
     * Access to ChatUserRepository methods *
     ****************************************/

    public function getChatUserByUser(User $user)
    {
        return $this->chatUserRepo->findChatUserByUser($user);
    }

    public function getChatUsers(
        $search = '',
        $orderedBy = 'username',
        $order = 'ASC',
        $withPager = true,
        $page = 1,
        $max = 50
    )
    {
        $chatUsers = $this->chatUserRepo->findChatUsers($search, $orderedBy, $order);

        return $withPager ?
            $this->pagerFactory->createPagerFromArray($chatUsers, $page, $max) :
            $chatUsers;
    }

    public function getAllUsersFromChatUsers()
    {
        $users = array();
        $chatUsers = $this->chatUserRepo->findAll();

        foreach ($chatUsers as $chatUser) {
            $users[] = $chatUser->getUser();
        }

        return $users;
    }
}